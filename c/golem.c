#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "golem.h"

void die(const char *message) {
  fprintf(stderr, "Error: %s\n", message);
  exit(1);
}

// TODO intern strings

// Create a new tag with a sign and a name.
golem_tag *new_tag(bool sign, char *name) {
  golem_tag *tag = (golem_tag *)malloc(sizeof(golem_tag));
  if (tag) {
    tag->name = name;
    tag->sign = sign;
    tag->next = NULL;
  }
  return tag;
}

// Create a new item with a name.
golem_item *new_item(char *name) {
  golem_item *item = (golem_item *)malloc(sizeof(golem_item));
  if (item) {
    item->name = name;
    item->tags = NULL;
    item->parent = NULL;
    item->first_child = NULL;
    item->next_sibling = NULL;
    item->next = NULL;
  }
  return item;
}

// Add the tag t to the item, keeping the tags sorted by name. If there already
// was a tag with the same name, don’t add it and discard t (but update the sign
// of the existing tag.)
void tag_item(golem_item *item, golem_tag *tag) {
  golem_tag *t, *p;
  for (t = item->tags, p = NULL; t && strcmp(t->name, tag->name) < 0;
      p = t, t = t->next);
  if (t && strcmp(t->name, tag->name) == 0) {
    t->sign = tag->sign;
    free(tag->name);
    free(tag);
  } else {
    tag->next = t;
    if (p) {
      p->next = tag;
    } else {
      item->tags = tag;
    }
  }
}

// Create a new rule with the item set.
golem_rule *new_rule(golem_item *item) {
  golem_rule *rule = (golem_rule *)malloc(sizeof(golem_rule));
  if (rule) {
    rule->item = item;
    rule->target = NULL;
    rule->others = NULL;
    rule->next = NULL;
  }
  return rule;
}


// Tokenizer
typedef struct {
  char *input;
  size_t position;
  size_t offset;
  char last;
  int token;
} golem_tokenizer;

// Token types
enum {
  token_eof = 0,
  token_error = -1,
  token_name = -2,
  token_string = -3,
  token_ref = -4
};

// Initialize the tokenizer with an input string.
void init_tokenizer(golem_tokenizer *tokenizer, char *input) {
  tokenizer->input = input;
  tokenizer->position = 0;
  tokenizer->offset = 0;
  tokenizer->last = ' ';
  tokenizer->token = tokenizer->last;
}

// Get the next token.
int get_token(golem_tokenizer *tokenizer) {
next_token:
  while (isspace(tokenizer->last)) {
    tokenizer->last = tokenizer->input[tokenizer->position++];
  }
  switch (tokenizer->last) {
    case '\0':
      return tokenizer->token = token_eof;
    case '(':
      while (tokenizer->last != ')') {
        if (tokenizer->last == '\0') {
          return tokenizer->token = token_error;
        }
        tokenizer->last = tokenizer->input[tokenizer->position++];
      }
      tokenizer->last = tokenizer->input[tokenizer->position++];
      goto next_token;
    case '"':
    case '\'':
      tokenizer->offset = tokenizer->position;
      char q = tokenizer->last;
      do {
        tokenizer->last = tokenizer->input[tokenizer->position++];
        if (tokenizer->last == '\0') {
          return tokenizer->token = token_error;
        }
      } while (tokenizer->last != q);
      tokenizer->last = tokenizer->input[tokenizer->position++];
      return tokenizer->token = token_string;
    case ')':
      return tokenizer->token = token_error;
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
      tokenizer->offset = tokenizer->position - 1;
      if (tokenizer->last >= '0' && tokenizer->last <= '9') {
        while (tokenizer->last >= '0' && tokenizer->last <= '9') {
          tokenizer->last = tokenizer->input[tokenizer->position++];
        }
        return tokenizer->token = token_ref;
      }
      for (;;) {
        tokenizer->last = tokenizer->input[tokenizer->position++];
        switch (tokenizer->last) {
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
            return tokenizer->token = token_name;
          default:
            if (isspace(tokenizer->last)) {
              return tokenizer->token = token_name;
            }
        }
      }
  }
  int token = tokenizer->last;
  tokenizer->last = tokenizer->input[tokenizer->position++];
  return tokenizer->token = token;
}

// Get the token string for the last seen token (used for names and strings.)
// A new string is returned.
char *get_token_string(golem_tokenizer *tokenizer) {
  return strndup(tokenizer->input + tokenizer->offset,
      tokenizer->position - tokenizer->offset -
      (tokenizer->token == token_string ? 2 : 1));
}

// Get the reference for the last seen token (used for references.)
int get_token_ref(golem_tokenizer *tokenizer) {
  return (int)strtol(tokenizer->input + tokenizer->offset, NULL, 10);
}


// Parser

// Parse a tag (starting from a current token of '+' or '-') and return it.
// Return NULL on error.
golem_tag *parse_tag(golem_tokenizer *tokenizer) {
  log("> parse tag [%d]\n", tokenizer->token);
  bool sign = tokenizer->token == '+';
  int token = get_token(tokenizer);
  if (token != token_name) {
    die("parse tag: expected name");
  }
#ifdef DEBUG
  golem_tag *tag = new_tag(sign, get_token_string(tokenizer));
  log("< parsed tag %c%s [%d]\n", tag->sign ? '+' : '-', tag->name,
      tokenizer->token);
  return tag;
#else
  return new_tag(sign, get_token_string(tokenizer));
#endif
}

golem_item *parse_item(golem_tokenizer *);

// Parse all child items enclosed in [] and separated by ,
golem_item *parse_item_children(golem_tokenizer *tokenizer) {
  log("> parse children [%d]\n", tokenizer->token);
  golem_item *first_child = NULL, *child;
  for (;;) {
    if (!first_child) {
      first_child = child = parse_item(tokenizer);
    } else {
      child = child->next = parse_item(tokenizer);
    }
    log("- got child “%s”\n", child->name);
    if (tokenizer->token == ']') {
      break;
    } else if (tokenizer->token != ',') {
      die("parse item children: expected ,");
    }
  }
  log("< parsed children [%d]\n", tokenizer->token);
  return first_child;
}

// Append to the name of the item (used during parsing since names can have
// whitespace in them.)
void append_to_item_name(golem_item *item, char *name) {
  if (!item->name) {
    item->name = name;
  } else {
    size_t l1 = strlen(item->name);
    size_t l2 = strlen(name);
    item->name = (char *)realloc(item->name, sizeof(char) * l1 + l2 + 2);
    if (item->name) {
      item->name[l1] = ' ';
      (void)strncpy(item->name + l1 + 1, name, l2);
      item->name[l1 + l2 + 1] = '\0';
      free(name);
    }
  }
}

// Parse an item description (name, tags, child items, ...)
golem_item *parse_item(golem_tokenizer *tokenizer) {
  log("> parse item [%d]\n", tokenizer->token);
  golem_item *item = new_item(NULL), *child, *children;
  golem_tag *tag;
  int token;
  for (;;) {
    token = get_token(tokenizer);
    switch (token) {
      case token_name:
        append_to_item_name(item, get_token_string(tokenizer));
        break;
      case '+':
      case '-':
        tag = parse_tag(tokenizer);
        tag_item(item, tag);
        break;
      case '[':
        children = parse_item_children(tokenizer);
        for (child = item->first_child; child && child->next_sibling;
            child = child->next_sibling);
        if (child) {
          child->next_sibling = children;
        } else {
          item->first_child = children;
        }
        break;
      case ',':
      case ';':
      case ':':
      case '.':
      case ']':
        log("< parsed item “%s” [%d]\n", item->name, tokenizer->token);
        return item;
      default:
        die("parse item: expected name, tag, children or rule separator.");
    }
  }
  die("parse item: unfinished item");
}

// Parse the “others” part of a rule (after ;, before :)
void parse_rule_others(golem_tokenizer *tokenizer, golem_rule *rule) {
  golem_item *item;
  golem_item *last = NULL;
  for (;;) {
    item = parse_item(tokenizer);
    if (last) {
      last->next_sibling = item;
    } else {
      rule->others = item;
    }
    last = item;
    if (tokenizer->token == ':') {
      return;
    } else if (tokenizer->token != ',') {
      die("parse rule (others): expected , or :");
    }
  }
}

// Parse an effect from the list of effects.
golem_effect *parse_effect(golem_tokenizer *tokenizer) {
  log("> parse effect [%d]\n", tokenizer->token);
  int token;
  golem_effect *effect = (golem_effect *)malloc(sizeof(effect));
  effect->reference = 0;
  effect->param.reference = 0;
  effect->next = NULL;
  switch (tokenizer->token) {
    case token_name:
      effect->type = effect_item;
      effect->param.item = parse_item(tokenizer);
      log("- item effect (%s)\n", effect->param.item->name);
      break;
    case token_string:
      effect->type = effect_string;
      effect->param.string = get_token_string(tokenizer);
      log("- string effect (%s)\n", effect->param.string);
      break;
    case token_ref:
      effect->reference = get_token_ref(tokenizer);
      token = get_token(tokenizer);
      switch (token) {
        case '+':
        case '-':
          effect->type = effect_tag;
          effect->param.tag = parse_tag(tokenizer);
          log("- tag effect (%d/%c%s)\n", effect->reference,
              effect->param.tag->sign ? '+' : '-', effect->param.tag->name);
          break;
        case '[':
          token = get_token(tokenizer);
          switch (token) {
            case token_ref:
              effect->type = effect_move_ref_ref;
              effect->param.reference = get_token_ref(tokenizer);
              log("- move ref/ref effect (%d/%d)\n", effect->reference,
                  effect->param.reference);
              break;
            case token_name:
              effect->type = effect_move_ref_item;
              effect->param.item = parse_item(tokenizer);
              log("- move ref/item effect (%d/%s)\n", effect->reference,
                  effect->param.item->name);
              break;
            default:
              die("parse effect: error parsing move effect");
          }
          token = get_token(tokenizer);
          if (token != ']') {
            die("parse effect: error parsing move effect, expected ]");
          }
          break;
        default:
          return NULL;
      }
      break;
    case '-':
      token = get_token(tokenizer);
      if (token != token_ref) {
        die("parse effect: expected reference after -");
      }
      effect->type = effect_remove;
      effect->reference = get_token_ref(tokenizer);
      log("- remove effect (%d)\n", effect->reference);
      break;
    default:
      die("parse effect: syntax error");
  }
  log("< parsed effect (%d) [%d]\n", effect->type, tokenizer->token);
  return effect;
}

// Parse the effects of a rule (after :)
bool parse_rule_effects(golem_tokenizer *tokenizer, golem_rule *rule) {
  log("> parse effects [%d]\n", tokenizer->token);
  get_token(tokenizer);
  golem_effect *effect = NULL, *last = NULL;
  for (;;) {
    effect = parse_effect(tokenizer);
    log("= got an effect (%d)\n", effect->type);
    if (last) {
      last->next = effect;
      log("+ adding effect after last (%d -> %d)\n", last->type, effect->type);
    } else {
      rule->effects = effect;
    }
    last = effect;
    int token = get_token(tokenizer);
    log("- got an effect (%d), next [%d]\n", effect->type, token);
    if (token == '.') {
      log("< parsed effects [%d]\n", tokenizer->token);
      return false;
    }
    if (token != ',') {
      if (effect->type == effect_string) {
        log("< parsed effects; last: %d [%d]\n", effect->type,
            tokenizer->token);
        return true;
      }
      die("parse effects: expected string or .");
    }
    (void)get_token(tokenizer);
  }
}

// Parse a rule completely, from the first item to the final period (or string).
golem_rule *parse_rule(golem_tokenizer *tokenizer) {
  log("> parse rule [%d]\n", tokenizer->token);
  golem_rule *rule = new_rule(parse_item(tokenizer));
  if (tokenizer->token == ',') {
    log("- parse rule: target\n");
    rule->target = parse_item(tokenizer);
  }
  if (tokenizer->token == ';') {
    log("- parse rule: others\n");
    parse_rule_others(tokenizer, rule);
  }
  if (tokenizer->token == ':') {
    log("- parse rule: effects\n");
    if (parse_rule_effects(tokenizer, rule)) {
      log("< parsed rule [%d]\n", tokenizer->token);
      return rule;
    }
  }
  if (tokenizer->token == '.') {
    get_token(tokenizer);
    log("< parsed rule [%d]\n", tokenizer->token);
    return rule;
  }
  log("Error: unfinished rule.\n");
  return NULL;
}

// Parse all rules for a given input and return the list of parsed rules.
golem_rule *parse_rules(char *input) {
  golem_tokenizer tokenizer;
  init_tokenizer(&tokenizer, input);
  golem_rule *rules = NULL;
  golem_rule *last = NULL;
  do {
    golem_rule *rule = parse_rule(&tokenizer);
    if (!rule) {
      return NULL;
    }
    if (last) {
      last->next = rule;
    } else {
      rules = rule;
    }
    last = rule;
  } while (tokenizer.token != token_error && tokenizer.token != token_eof);
  free(input);
  return rules;
}

#define SLURP_CHUNK_SIZE 4096

// Slurp a whole file into a string.
char *slurp_file(FILE *fp) {
  size_t length = 0;
  char *string = (char *)malloc(sizeof(char) * SLURP_CHUNK_SIZE);
  size_t read = fread(string, sizeof(char), SLURP_CHUNK_SIZE, fp);
  length += read;
  while (read == SLURP_CHUNK_SIZE) {
    string = (char *)realloc(string, sizeof(char) * length + SLURP_CHUNK_SIZE);
    read = fread(string + length, sizeof(char), SLURP_CHUNK_SIZE, fp);
    length += read;
  }
  string = (char *)realloc(string, sizeof(char) * (length + 1));
  string[length] = '\0';
  return string;
}

// Parse all rules from STDIN.
int main(int argc, char *argv[]) {
  (void)parse_rules(slurp_file(stdin));
  return 0;
}