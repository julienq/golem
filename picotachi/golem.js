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
    once: true,
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
  function extend (prototype, ext) {
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

    init: function (name) {
      golem.Listenable.init.call(this);
      golem.Hierarchical.init.call(this);
      this.name = name;
      this.tags = {};
    },

    item: function (item) {
      foreach(arguments, this.append_child.bind(this));
      return this;
    },

    did_append_child: function (child) {
      this.notify("item", { item: child });
    },

    did_remove_child: function (child) {
      this.notify("unitem", { item: child });
    },

    tag: function () {
      foreach(arguments, function (tag) {
        if (tag && !this.tags[tag]) {
          this.tags[tag] = true;
          this.notify("tag", { tag: tag });
        }
      }, this);
      return this;
    },

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
            return "+" + tag;
          }).join("");
      }
      this._description = desc;
      return this;
    }

  }, golem.Creatable, golem.Hierarchical, golem.Listenable);


  if (typeof require === "function") {
    var A = golem.Item.create("A");
    console.log(A.description());
    var B = golem.Item.create("B").description("Point B");
    console.log(B.description());
    var alice = golem.Item.create("Alice").tag("PC");
    var door = golem.Item.create("door");
    A.item(alice, door);
    console.log(A.__children.map(function (item) { return item.description(); }));
    door.tag("Open");
    B.item(alice);
    console.log(A.__children.map(function (item) { return item.description(); }),
      B.__children.map(function (item) { return item.description(); }));
    A.listen("item", function (e) {
      console.log("  + item: %0 (%1)"
        .fmt(e.source.description(), e.item.description()));
    }, flags.once);
  }

}());
