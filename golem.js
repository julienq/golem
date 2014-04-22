(function () {
  "use strict";

  if (typeof window === "object") {
    window.golem = {};
    window.global = window;
  } else if (typeof require === "function") {
    global.golem = exports;
  }

  golem.version = "0.1";

  var flags = {
    asynchronous: false,
    negative: true,
    once: true,
    set_unfinished: true,
    synchronous: true,
  };

  // Simple format function for messages and templates. Use %0, %1... as slots
  // for parameters; %(n) can also be used to avoid possible ambiguities (e.g.
  // "x * 10 = %(0)0".) %% is also replaced by %. Null and undefined are
  // replaced by an empty string.
  String.prototype.fmt = function () {
    var args = arguments;
    return this.replace(/%(\d+|%|\((\d+)\))/g, function (_, p, pp) {
      // jshint unused: false, eqnull: true
      var p_ = parseInt(pp || p, 10);
      return p === "%" ? "%" : args[p_] == null ? "" : args[p_];
    });
  };

  var call = Function.prototype.call;
  var foreach = call.bind(Array.prototype.forEach);

  // Flip the parameters of a function of arity 2
  function flip(f) {
    return function (x, y) {
      return f(y, x);
    }
  }

  // Hack using postMessage to provide a setImmediate replacement; inspired by
  // https://github.com/NobleJS/setImmediate
  var asap = global.setImmediate ? global.setImmediate.bind(global) :
    global.postMessage ? (function () {
      var queue = [];
      var key = Math.random().toString(36);
      global.addEventListener("message", function (e) {
        if (e.data === key) {
          var q = queue.slice();
          queue = [];
          for (var i = 0, n = q.length; i < n; ++i) {
            var f = q[i];
            f();
          }
        }
      }, false);
      return function (f) {
        queue.push(f);
        global.postMessage(key, "*");
      };
    }()) : flip(global.setTimeout).bind(global, 0);

  function nop() {}

  // Extend a prototype object with methods from an additional object.
  function extend(prototype, ext) {
    var object = Object.create(prototype);
    for (var p in ext) {
      object[p] = ext[p];
    }
    return object;
  }

  // Extend an object with method from one or more mixin, not overwriting any
  // previously defined method.
  function mixin(object) {
    for (var i = 1, n = arguments.length; i < n; ++i) {
      for (var p in arguments[i]) {
        if (!(p in object)) {
          object[p] = arguments[i][p];
        }
      }
    }
    return object;
  }


  // Creatable objects can be created from a prototype and their init method is
  // called from the create() method.
  golem.Creatable = {
    init: nop,
    create: function () {
      var object = Object.create(this);
      this.init.apply(object, arguments);
      return object;
    }
  };


  // Mixin for hierarchical items
  golem.Hierarchical = {

    init: function () {
      this.__children = [];
    },

    did_append_child: nop,
    will_append_child: nop,

    append_child: function (child) {
      if (child.__parent && child.__parent !== this) {
        child.__parent.remove_child(child);
      }
      if (!child.__parent) {
        child.__parent = this;
        this.will_append_child(child);
        this.__children.push(child);
        this.did_append_child(child);
        return child;
      }
    },

    did_remove_child: nop,
    will_remove_child: nop,

    remove_child: function (child) {
      if (child.__parent === this) {
        var index = this.__children.indexOf(child);
        if (index >= 0) {
          this.will_remove_child(child);
          this.__children.splice(index, 1);
          delete child.__parent;
          this.did_remove_child(child);
          return child;
        }
      }
    }
  };


  // Mixin to allow objects to send event notifications. A non-enumerable
  // `__listeners` property will be added to the object.
  golem.Listenable = {

    // Create the listeners property
    init: function () {
      Object.defineProperty(this, "__listeners", { value: {} });
    },

    // Send an event notification from this object.
    notify: function (type, e, synchronous) {
      if (!e) {
        e = {};
      }
      e.source = this;
      e.type = type;
      return synchronous ? notify.call(this, type, e) :
        asap(notify.bind(this, type, e));
    },

    // Set `handler` (either a function or an object with a `handleEvent`
    // method) to handle events of type `type` from this. Set the `once` flag to
    // true to remove the handler automatically after it was handled. Return the
    // handler.
    listen: function (type, handler, once) {
      if (!this.__listeners[type]) {
        this.__listeners[type] = [];
      }
      var listener = function (e) {
        if (typeof handler === "function") {
          handler(e);
        } else if (typeof handler === "object" &&
            typeof handler.handleEvent === "function") {
          handler.handleEvent(e);
        }
        if (once) {
          this.unlisten(type, handler);
        }
      }.bind(this);
      listener.handler = handler;
      this.__listeners[type].push(listener);
      return handler;
    },

    // Stop `handler` from handling events of type `type`.
    unlisten: function (type, handler) {
      if (this.__listeners && this.__listeners[type]) {
        var i = 0;
        var n = this.__listeners[type].length;
        for (; i < n && this.__listeners[type][i].handler !== handler; ++i) {}
        if (i < n) {
          this.__listeners[type].splice(i, 1);
          if (n === 1) {
            delete this.__listeners[type];
          }
          return handler;
        }
      }
    }
  };

  // Helper function for Listenable.notify
  function notify(type, e) {
    // jshint -W040
    if (this.__listeners && this.__listeners[type]) {
      for (var i = this.__listeners[type].length - 1; i >= 0; --i) {
        this.__listeners[type][i](e);
      }
    }
  }


  // Base class for items (including locations)
  golem.Item = mixin({

    // Create a new item with the given name.
    init: function (name) {
      golem.Listenable.init.call(this);
      golem.Hierarchical.init.call(this);
      this.name = name;
      this.tags = {};
    },

    // Add items as a child of this item and return the item.
    item: function () {
      foreach(arguments, this.append_child.bind(this));
      return this;
    },

    // Notification for adding a child item.
    did_append_child: function (child) {
      this.notify("item", { item: child });
    },

    // Notification for removing a child item.
    did_remove_child: function (child) {
      this.notify("unitem", { item: child });
    },

    // Add tags to an item and return this item.
    tag: function () {
      foreach(arguments, function (tag) {
        if (typeof tag === "string") {
          tag = Tag.tag(tag);
        }
        if (tag && !this.tags[tag.name]) {
          this.tags[tag.name] = tag.item(this);
          this.notify("tag", { tag: tag });
        }
      }, this);
      return this;
    },

    // Remove a tag from an item and return it if it was indeed removed.
    untag: function (tag) {
      if (this.tags[tag]) {
        delete this.tags[tag];
        this.notify("untag", { tag: tag });
        return tag;
      }
    },

    description: function (desc) {
      if (arguments.length === 0) {
        return this._description ||
          this.name + Object.keys(this.tags).map(function (tag) {
            return tag.toString();
          }).join("");
      }
      this._description = desc;
      return this;
    },

    // Match a pattern item.
    match: function (pattern) {
      var m = !pattern.name || pattern.name === this.name;
      return m;
    }

  }, golem.Creatable, golem.Hierarchical, golem.Listenable);

  // Get the location of an item. A location is simply an item with no parent.
  Object.defineProperty(golem.Item, "location", {
    enumerable: true,
    configurable: true,
    get: function () {
      return this.__parent && this.__parent.location || this;
    }
  });


  // The tag object keeps track of all items that have this tag. A tag can be
  // negative as well.
  var Tag = golem.Tag = mixin({

    // Keep track of all tags
    tags: {},

    // Initialize a new tag with the given name and no item.
    init: function (name) {
      this.name = name;
      this.items = {};
    },

    // Return the tag for the given name, creating it if necessary.
    tag: function (name) {
      if (!this.tags[name]) {
        this.tags[name] = this.create(name);
      }
      return this.tags[name];
    },

    // Add an item to the tag and return the tag (when this item is tagged.)
    item: function (item) {
      if (!this.items[item.name]) {
        this.items[item.name] = [];
      }
      this.items[item.name].push(item);
      return this;
    },

    // Remove an item from the tag and return the tag (when the item is
    // untagged.)
    unitem: function (item) {
      var items = this.items[item.name];
      var index = items && items.indexOf(item);
      if (index >= 0) {
        if (items.length === 1) {
          delete this.items[item.name];
        } else {
          items.splice(index, 1);
        }
        return this;
      }
    },

    toString: function () {
      return "+" + this.name;
    }
  }, golem.Creatable);

  // Negative tag for pattern matching.
  var Untag = golem.Untag = extend(Tag, {
    negative: true,
    toString: function () {
      return "-" + this.name;
    }
  });


  golem.Automaton = mixin({

    init: function () {
      this.states = [];
      this.state();
    },

    state: function () {
      var state = golem.State.create();
      state.automaton = this;
      this.states.push(state);
      return state;
    }

  }, golem.Creatable);


  // Automaton states maintain their list of incoming and outgoing edges,
  // indexed by the symbol on the edge. A final state also has an action.
  golem.State = mixin({

    init: function () {
      this.incoming = [];
      this.outgoing = [];
    },

    out: function (edge) {
      this.outgoing.push(edge);
      console.log("Outgoing edge from s%0 (%1)"
        .fmt(this.automaton.states.indexOf(this), this.outgoing.length));
      edge.source = this;
      return edge.dest;
    }

  }, golem.Creatable);


  golem.Edge = mixin({
    init: function (dest, weight) {
      this.dest = dest;
      dest.incoming.push(this);
      this.weight = weight || 0;
    }
  }, golem.Creatable);


  golem.NameEdge = extend(golem.Edge, {
    init: function (label, dest, weight) {
      this.label = label;
      golem.Edge.init.call(this, dest, weight);
    }
  });


  golem.TagEdge = extend(golem.Edge, {
    init: function (tag, dest, weight) {
      this.tag = tag;
      golem.Edge.init.call(this, dest, weight);
    }
  });


  golem.CommaEdge = extend(golem.Edge, {
  });


  golem.SemicolonEdge = extend(golem.Edge, {
  });


  // An effect edge has no destination and can be followed iff there is no input
  // left to match.
  golem.EffectEdge = extend(golem.Edge, {
    init: function (effect, weight) {
      this.weight = weight || 0;
    }
  });


  // Effect functions
  function status(msg) {
    return function() {
      // TODO
    }
  }


  function move(x, y) {
    return function () {
      // TODO
    }
  }

  // Test automaton
  var automaton = golem.Automaton.create();

  automaton.states[0]
    .out(golem.NameEdge.create("Alice", automaton.state()))
    .out(golem.EffectEdge.create(status("You are Alice, the famous explorer.")));

  automaton.states[0]
    .out(golem.NameEdge.create("stone", automaton.state()))
    .out(golem.EffectEdge.create(status("A plain looking stone", 1)));
  
  automaton.states[0]
    .out(golem.NameEdge.create("hole", automaton.state()))
    .out(golem.EffectEdge.create(status("There seems to be a dark tunnel below."),
          2));

  automaton.states[2]
    .out(golem.CommaEdge.create(automaton.state()))
    .out(golem.TagEdge.create("+PC", automaton.state()))
    .out(golem.EffectEdge.create(move(2, 1), 3));

  console.log(automaton);


}());
