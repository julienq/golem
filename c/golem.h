#ifndef __GOLEM__H__
#define __GOLEM__H__

#ifdef DEBUG
#define log(...) fprintf(stderr, __VA_ARGS__)
#else
#define log(...)
#endif

// A tag has a sign and a name, and can be part of a list of tags.
typedef struct tag {
  char *name;
  bool sign;
  struct tag *next;
} golem_tag;

extern golem_tag *new_tag(bool, char *);

// An item, either in the game or in a rule.
typedef struct item {
  char *name;
  golem_tag *tags;
  struct item *parent;
  struct item *first_child;
  struct item *next_sibling;
  struct item *next;
} golem_item;

extern golem_item *new_item(char *);
extern void tag_item(golem_item *, golem_tag *);

// Rules and effects

typedef struct effect {
  union {
    char *string;
    golem_tag *tag;
    golem_item *item;
    int reference;
  } param;
  int type;
  int reference;
  struct effect *next;
} golem_effect;

enum {
  effect_item,           // create a new item (item): shovel, box+Closed[key]
  effect_remove,         // remove a reference (none): -1
  effect_tag,            // tag a reference (tag): 1+Tag
  effect_move_ref_ref,   // move a reference into another reference (ref): 3[1]
  effect_move_item_ref,  // move a reference into an item (item): box[1] (TODO)
  effect_move_ref_item,  // move an intem into a reference (item): 1[key]
  effect_string          // string (string): "hello, world."
};

// A rule
typedef struct rule {
  golem_item *item;
  golem_item *target;
  golem_item *others;
  golem_effect *effects;
  struct rule *next;
} golem_rule;

extern golem_rule *new_rule(golem_item *);

#endif
