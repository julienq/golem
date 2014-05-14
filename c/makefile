CFLAGS = -Wall -std=c11 -pedantic

OUT = golem
OBJECTS = $(OUT).o

all:	$(OUT)

debug:	CFLAGS += -g -DDEBUG
debug:	$(OUT)

.o:	.c
	$(CC) $(CFLAGS) $< -o $@

$(OUT):	$(OBJECTS)
	$(CC) $(LDFLAGS) -o $@ $^

clean:
	$(RM) $(OUT) $(OBJECTS) && $(RM) -r $(OUT).dSYM
