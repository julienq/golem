#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define SLURP_CHUNK_SIZE 4096

enum {
  token_eof = 0,
  token_error = -1,
  token_name = -2,
  token_string = -3,
  token_ref = -4
};

typedef struct {
  char *input;
  char last;
  size_t position;
  size_t offset;
} tokenizer;

void init_tokenizer(tokenizer *t, char *input) {
  t->input = input;
  t->last = ' ';
  t->position = 0;
}

int get_token(tokenizer *t) {
next_token:
  while (isspace(t->last)) {
    t->last = t->input[t->position++];
  }
  switch (t->last) {
    case '\0':
      return token_eof;
    case '(':
      while (t->last != ')') {
        if (t->last == '\0') {
          return token_error;
        }
        t->last = t->input[t->position++];
      }
      t->last = t->input[t->position++];
      goto next_token;
    case '"':
    case '\'':
      t->offset = t->position;
      char q = t->last;
      do {
        t->last = t->input[t->position++];
        if (t->last == '\0') {
          return token_error;
        }
      } while (t->last != q);
      t->last = t->input[t->position++];
      return token_string;
    case ')':
      return token_error;
    case ',':
    case ';':
    case ':':
    case '.':
    case '^':
    case '[':
    case ']':
    case '+':
    case '-':
      break;
    default:
      t->offset = t->position - 1;
      if (t->last >= '0' && t->last <= '9') {
        while (t->last >= '0' && t->last <= '9') {
          t->last = t->input[t->position++];
        }
        return token_ref;
      }
      for (;;) {
        t->last = t->input[t->position++];
        switch (t->last) {
          case '\0':
          case '(':
          case ')':
          case '"':
          case '\'':
          case ',':
          case ';':
          case ':':
          case '.':
          case '^':
          case '[':
          case ']':
          case '+':
          case '-':
            return token_name;
          default:
            if (isspace(t->last)) {
              return token_name;
            }
        }
      }
  }
  char token = t->last;
  t->last = t->input[t->position++];
  return token;
}

char *get_token_string(tokenizer *t) {
  return strndup(t->input + t->offset, t->position - t->offset - 1);
}


// Slurp a whole file into a string
char *slurp_file(FILE *fp) {
  size_t size = SLURP_CHUNK_SIZE;
  size_t length = 0;
  char *string = (char *)malloc(sizeof(char) * size);
  size_t read = fread(string, sizeof(char), SLURP_CHUNK_SIZE, fp);
  length += read;
  while (read == SLURP_CHUNK_SIZE) {
    size += SLURP_CHUNK_SIZE;
    string = (char *)realloc(string, sizeof(char) * size);
    read = fread(string + length, sizeof(char), SLURP_CHUNK_SIZE, fp);
    length += read;
  }
  string = (char *)realloc(string, sizeof(char) * (length + 1));
  string[length] = '\0';
  return string;
}

int main(int argc, char *argv[]) {
  tokenizer t;
  init_tokenizer(&t, slurp_file(stdin));
  int token;
  do {
    token = get_token(&t);
    switch (token) {
      case token_eof:
        break;
      case token_error:
        fprintf(stderr, "ERROR\n");
        break;
      case token_name:
        fprintf(stderr, "NAME<%s>\n", get_token_string(&t));
        break;
      case token_string:
        fprintf(stderr, "STRING<%s>\n", get_token_string(&t));
        break;
      case token_ref:
        fprintf(stderr, "REF<%s>\n", get_token_string(&t));
        break;
      default:
        fprintf(stderr, "%c\n", token);
    }
  } while (token != token_error && token != token_eof);
  free(t.input);
  return 0;
}
