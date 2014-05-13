(function () {
  "use strict";

  /* global global, window */

  if (typeof window === "object") {
    window.global = window;
  }

  // Strings

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

  // Pad a string to the given length with the given padding (defaults to 0)
  // if it is shorter. The padding is added at the beginning of the string.
  global.pad = function (string, length, padding) {
    if (typeof padding !== "string") {
      padding = "0";
    }
    if (typeof string !== "string") {
      string = string.toString();
    }
    var l = length + 1 - string.length;
    return l > 0 ? (new Array(l).join(padding)) + string : string;
  };

  // Convert a string with dash to camel case: remove dashes and capitalize the
  // following letter (e.g., convert foo-bar to fooBar)
  global.undash = function (s) {
    return s.replace(/-+(.?)/g, function (_, p) {
      // jshint unused: false
      return p.toUpperCase();
    });
  };


  // Numbers

  global.π = Math.PI;

  // Return the value constrained between min and max. A NaN value is converted
  // to 0 before being clamped. min and max are assumed to be numbers such that
  // min <= max.
  global.clamp = function (value, min, max) {
    return Math.max(Math.min(isNaN(value) ? 0 : value, max), min);
  };

  // Linear interpolation of ratio from from to to.
  global.lerp = function (value, from, to) {
    return from + (to - from) * value;
  };

  // Return a random integer in the [min, max] range, assuming min <= max. The
  // min parameter may be omitted and defaults to zero.
  global.random_int = function (min, max) {
    if (arguments.length === 1) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max + 1 - min));
  };

  // Return a random number in the [min, max[ range, assuming min < max. The min
  // parameter may be omitted and defaults to zero.
  global.random_number = function (min, max) {
    if (arguments.length === 1) {
      max = min;
      min = 0;
    }
    return min + Math.random() * (max - min);
  };

  // Remap a value from a given range to another range (from Processing)
  global.remap = function (value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  };


  // Functions

  global.call = Function.prototype.call;
  global.apply = Function.prototype.apply;
  global.bind = global.call.bind(Function.prototype.bind);
  "filter forEach map push pop reduce shift slice splice unshift".split(" ")
    .forEach(function (f) {
      global[f.toLowerCase()] = global.call.bind(Array.prototype[f]);
    });
  "push unshift".split(" ").forEach(function (f) {
    global[f + "_all"] = global.apply.bind(Array.prototype[f]);
  });

  // Do nothing and return nothing
  global.nop = function () {
  };

  // Return this
  global.self = function () {
    // jshint -W040
    return this;
  };

  // Return the first argument
  global.fst = function (x) {
    return x;
  };

  // Return the second argument
  global.snd = function (_, y) {
    // jshint unused: true
    return y;
  };

  // Turn a value into a 0-ary function returning that value
  global.constant = function (x) {
    return typeof x === "function" ? x : function () {
      return x;
    };
  };

  // Return a function that discards its arguments. An optional parameter allows
  // to keep at most n arguments (defaults to 0 of course.)
  global.discard = function (f, n) {
    return function () {
      return f.apply(this, global.slice(arguments, 0, n >>> 0));
    };
  };

  // This function can be called to fail early. If called with no parameter or a
  // single parameter evaluating to a truthy value, throw a "fail" exception;
  // otherwise, return false.
  global.fail = function (p) {
    if (!arguments.length || p) {
      throw "fail";
    }
    return false;
  };

  // Flip the parameters of a function of arity 2
  global.flip = function (f) {
    return function (x, y) {
      return f(y, x);
    };
  };

  // Hack using postMessage to provide a setImmediate replacement; inspired by
  // https://github.com/NobleJS/setImmediate
  global.asap = global.setImmediate ? global.setImmediate.bind(global) :
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
    }()) : global.flip(global.setTimeout).bind(global, 0);


  // Arrays

  // Return a random item from an array
  global.random_item = function (array) {
    if (array) {
      return array[global.random_int(array.length - 1)];
    }
  };

  // Remove an item from an array
  global.remove_item = function (array, item) {
    if (array) {
      var index = array.indexOf(item);
      if (index >= 0) {
        return array.splice(index, 1)[0];
      }
    }
  };

  // Shuffle the array into a new array (the original array is not changed and
  // the new, shuffled array is returned.)
  global.shuffle_array = function (array) {
    var shuffled = global.slice(array);
    for (var i = shuffled.length - 1; i > 0; --i) {
      var j = global.random_int(i);
      var x = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = x;
    }
    return shuffled;
  };


  // Objects

  // Extend a prototype object with methods from an additional object.
  global.extend = function (prototype, ext) {
    var object = Object.create(prototype);
    for (var p in ext) {
      object[p] = ext[p];
    }
    return object;
  };

  // Extend an object with method from one or more mixin, not overwriting any
  // previously defined method.
  global.mixin = function (object) {
    for (var i = 1, n = arguments.length; i < n; ++i) {
      for (var p in arguments[i]) {
        if (!(p in object)) {
          object[p] = arguments[i][p];
        }
      }
    }
    return object;
  };

  // Return all the values of an object (presumably used as a dictionary)
  global.values = function (object) {
    return Object.keys(object).map(function (key) {
      return object[key];
    });
  };

  global.generate_set = function (keys) {
  }

  // Creatable objects can be created from a prototype and their init method is
  // called from the create() method.
  global.Creatable = {
    init: global.nop,
    create: function () {
      var object = Object.create(this);
      this.init.apply(object, arguments);
      return object;
    }
  };

  // Mixin for hierarchical items
  global.Hierarchical = {

    init: function () {
      this.__children = [];
    },

    did_append_child: global.nop,
    will_append_child: global.nop,

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

    did_remove_child: global.nop,
    will_remove_child: global.nop,

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
  global.Listenable = {

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
        global.asap(notify.bind(this, type, e));
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


  // DOM

  if (typeof window === "object") {

    // Known XML namespaces and their prefixes for use with create_element
    // below. For convenience both "html" and "xhtml" are defined as prefixes
    // for XHTML.
    var ns = {
      html: "http://www.w3.org/1999/xhtml",
      m: "http://www.w3.org/1998/Math/MathML",
      svg: "http://www.w3.org/2000/svg",
      xhtml: "http://www.w3.org/1999/xhtml",
      xlink: "http://www.w3.org/1999/xlink",
      xml: "http://www.w3.org/1999/xml",
      xmlns: "http://www.w3.org/2000/xmlns/"
    };

    // Append a child node `ch` to `node`. If it is a string, create a text
    // node with the string as content; if it is an array, append all elements
    // of the array; if it is not a Node, then simply ignore it.
    global.append_child = function (node, ch) {
      if (typeof ch === "string") {
        node.appendChild(node.ownerDocument.createTextNode(ch));
      } else if (ch instanceof Array) {
        ch.forEach(function (ch_) {
          global.append_child(node, ch_);
        });
      } else if (ch instanceof window.Node) {
        node.appendChild(ch);
      }
    };

    // Simple way to create elements. The first argument is a string with the
    // name of the element (e.g., "rect"), and may also contain a namespace
    // prefix as defined in ns (e.g., "html:p"; the default is the namespace URI
    // of the document), class names, using "." as a separator similarly to CSS
    // (e.g., "html:p.important.description") and an id preceded by # (e.g.,
    // "html:p.important.description#rule; not that this id may not contain a .)
    // The second argument is optional and is an object defining attributes of
    // the element; its properties are names of attributes, and the values are
    // the values for the attribute. Note that a false, null or undefined value
    // will *not* set the attribute. Attributes may have namespace prefixes so
    // that we can use "xlink:href" for instance (e.g., elemet("svg:use",
    // { "xlink:href": "#foo" });)
    global.element = function (name, attrs) {
      var contents;
      if (typeof attrs === "object" && !(attrs instanceof window.Node) &&
          !Array.isArray(attrs)) {
        contents = global.slice(arguments, 2);
      } else {
        contents = global.slice(arguments, 1);
        attrs = {};
      }
      var classes = name.trim().split(".").map(function (x) {
        var m = x.match(/#(.*)$/);
        if (m) {
          attrs.id = m[1];
          return x.substr(0, m.index);
        }
        return x;
      });
      name = classes.shift();
      if (classes.length > 0) {
        attrs["class"] =
          (typeof attrs["class"] === "string" ? attrs["class"] + " " : "") +
            classes.join(" ");
      }
      var m = name.match(/^(?:([^:]+):)?/);
      var nsuri = (m[1] && ns[m[1].toLowerCase()]) ||
        window.documentElement.namespaceURI;
      var elem = window.document.createElementNS(nsuri,
          m[1] ? name.substr(m[0].length) : name);
      for (var a in attrs) {
        // jshint eqnull: true
        if (attrs[a] != null && attrs[a] !== false) {
          var sp = a.split(":");
          nsuri = sp[1] && ns[sp[0].toLowerCase()];
          if (nsuri) {
            elem.setAttributeNS(nsuri, sp[1], attrs[a]);
          } else {
            elem.setAttribute(a, attrs[a]);
          }
        }
      }
      contents.forEach(function (ch) {
        global.append_child(elem, ch);
      });
      return elem;
    };

    var tags = {
      html: ["a", "abbr", "address", "area", "article", "aside", "audio", "b",
        "base", "bdi", "bdo", "blockquote", "body", "br", "button", "canvas",
        "caption", "cite", "code", "col", "colgroup", "command", "datalist",
        "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt", "em",
        "embed", "fieldset", "figcaption", "figure", "footer", "form", "h1",
        "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
        "i", "iframe", "img", "input", "ins", "kbd", "keygen", "label",
        "legend", "li", "link", "map", "mark", "menu", "meta", "meter", "nav",
        "noscript", "object", "ol", "optgroup", "option", "output", "p",
        "param", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp",
        "script", "section", "select", "small", "source", "span", "strong",
        "style", "sub", "summary", "sup", "table", "tbody", "td", "textarea",
        "tfoot", "th", "thead", "time", "title", "tr", "tref", "track", "u",
        "ul", "var", "video", "wbr"],
      svg: ["altGlyph", "altGlyphDef", "altGlyphItem", "animate",
        "animateColor", "animateMotion", "animateTransform", "circle",
        "clipPath", "color-profile", "cursor", "defs", "desc", "ellipse",
        "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite",
        "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap",
        "feDistantLight", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR",
        "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology",
        "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight",
        "feTile", "feTurbulence", "filter", "font", "font-face",
        "font-face-format", "font-face-name", "font-face-src", "font-face-uri",
        "foreignObject", "g", "glyph", "glyphRef", "hkern", "image", "line",
        "linearGradient", "marker", "mask", "metadata", "missing-glyph",
        "mpath", "path", "pattern", "polygon", "polyline", "radialGradient",
        "rect", "set", "stop", "svg", "switch", "symbol", "text", "textPath",
        "tref", "tspan", "use", "view", "vkern"]
    };

    // Make shorthands for known HTML, SVG and MathML elements, e.g. $p,
    // $fontFaceFormat (for svg:font-face-format), &c.
    for (var prefix in tags) {
      // jshint loopfunc: true
      tags[prefix].forEach(function (tag) {
        global["$" + global.undash(tag)] = global.element.bind(window.document,
          "%0:%1".fmt(prefix, tag));
      });
    }

    // Remove all children of an element
    global.remove_children = function (elem) {
      while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
      }
    };

    // Friendlier description of a key press for a key event, returning an
    // all-lowercase string of the form "alt+shift+m", "up", "ctrl+space", etc.
    // Some key values might be numeric if they are not standard
    global.describe_key = function (e) {
      var key = [];
      ["alt", "ctrl", "meta", "shift"].forEach(function (k) {
        if (e[k + "Key"]) {
          key.push(k);
        }
      });
      if (e.keyCode === 8) {
        key.push("del");
      } else if (e.keyCode === 9) {
        key.push("tab");
      } else if (e.keyCode === 13) {
        key.push("enter");
      } else if (e.keyCode === 16) {
        if (!e.shiftKey) {
          key.push("shift");
        }
      } else if (e.keyCode === 17) {
        if (!e.ctrlKey) {
          key.push("ctrl");
        }
      } else if (e.keyCode === 18) {
        if (!e.altKey) {
          key.push("alt");
        }
      } else if (e.keyCode === 27) {
        key.push("esc");
      } else if (e.keyCode === 32) {
        key.push("space");
      } else if (e.keyCode === 37) {
        key.push("left");
      } else if (e.keyCode === 38) {
        key.push("up");
      } else if (e.keyCode === 39) {
        key.push("right");
      } else if (e.keyCode === 40) {
        key.push("down");
      } else if (e.keyCode === 46) {
        key.push("backspace");
      } else if (e.keyCode >= 48 && e.keyCode <= 57) {
        key.push(e.keyCode - 48);
      } else if (e.keyCode >= 65 && e.keyCode <= 90) {
        key.push(String.fromCharCode(e.keyCode + 32));
      } else if (e.keyCode === 91 || e.keyCode === 93 || e.keyCode === 224) {
        if (!e.metaKey) {
          key.push("meta");
        }
      } else if (e.keyCode >= 112 && e.keyCode <= 123) {
        key.push("f" + (e.keyCode - 111));
      } else {
        key.push("?" + e.keyCode);
      }
      return key.join("+");
    };

  }


  // Color

  global.palette = {
    red: "#a61416",
    orange: "#ff6a4d",
    yellow: "#f8ca00",
    green: "#5eb26b",
    blue: "#4dbce9",
    indigo: "#0b486b",
    violet: "#ad2bad",
    brown: "#774f38",
    fuchsia: "#f94179",
    prussianblue: "#003153"
  };

  // Convert a color from hsv space (hue in radians, saturation and brightness
  // in the [0, 1] interval) to RGB, returned as an array of RGB values in the
  // [0, 256[ interval.
  global.hsv_to_rgb = function (h, s, v) {
    s = global.clamp(s, 0, 1);
    v = global.clamp(v, 0, 1);
    if (s === 0) {
      var v_ = Math.round(v * 255);
      return [v_, v_, v_];
    } else {
      h = (((h * 180 / global.π) + 360) % 360) / 60;
      var i = Math.floor(h);
      var f = h - i;
      var p = v * (1 - s);
      var q = v * (1 - (s * f));
      var t = v * (1 - (s * (1 - f)));
      return [Math.round([v, q, p, p, t, v][i] * 255),
        Math.round([t, v, v, q, p, p][i] * 255),
        Math.round([p, p, t, v, v, q][i] * 255)];
    }
  };

  // Convert a color from hsv space (hue in radians, saturation and brightness
  // in the [0, 1] interval) to an RGB hex value
  global.hsv_to_hex = function (h, s, v) {
    return global.rgb_to_hex.apply(this, global.hsv_to_rgb(h, s, v));
  };

  // Convert an RGB color (3 values in the [0, 256[ interval) to a hex value
  global.rgb_to_hex = function () {
    return "#" + global.map(arguments, function (x) {
      return global.pad(global.clamp(Math.floor(x), 0, 255).toString(16), 2);
    }).join("");
  };

  // Convert a number to a color hex string. Use only the lower 24 bits.
  global.num_to_hex = function (n) {
    return "#" +  global.pad((n & 0xffffff).toString(16), 6);
  };


  // Some objects

  global.Urn = global.mixin({

    // Initialize the urn with a list of items
    init: function (items) {
      this.items = arguments.length === 1 && Array.isArray(items) ? items :
        global.slice(arguments);
    },

    // Empty the urn.
    empty: function () {
      this._remaining = [];
      delete this._last_pick;
      return this;
    },

    // Pick an item from the urn, refilling it as necessary.
    pick: function () {
      var last;
      if (this._remaining.length === 0) {
        this._remaining = global.slice(this.items);
        if (this._remaining.length > 1 && this.hasOwnProperty("_last_pick")) {
          last = global.remove_item(this._remaining, this._last_pick);
        }
      }
      if (this._remaining.length > 0) {
        this._last_pick = this._remaining
          .splice(global.random_int(this._remaining.length - 1), 1)[0];
        if (last !== undefined) {
          this._remaining.push(last);
        }
        return this._last_pick;
      }
    },

    // Pick n elements from the urn and return as a list. Try to minimize
    // repetition as much as possible
    picks: function (n) {
      if (n > this._remaining.length && n <= this.items.length) {
        this._remaining = [];
      }
      var picks = [];
      for (var i = 0; i < n; ++i) {
        picks.push(this.pick());
      }
      return picks;
    },

    // Add an item to the urn
    add: function (item) {
      this.items.push(item);
      this._remaining.push(item);
      return this;
    },

    // Remove an item from the urn
    remove: function (item) {
      var removed = global.remove_item(this.items, item);
      global.remove_item(this._remaining, item);
      return removed;
    }
  }, global.Creatable);

  Object.defineProperty(global.Urn, "items", {
    enumberable: true,
    get: function () {
      return this._items;
    },
    set: function (items) {
      this._items = items;
      this.empty();
    }
  });

  Object.defineProperty(global.Urn, "remaining", {
    enumerable: true,
    get: function () {
      return this._remaining.length;
    }
  });

}());
