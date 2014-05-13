(function () {
  "use strict";

  /* global golem, window */

  // Add event listeners initialization
  golem.Item.init = (function () {
    var $super = golem.Item.init;
    return function () {
      $super.apply(this, arguments);
      this.listen("unitem", golem.ui.unitem);
      this.listen("tag", this.img.bind(this));
      this.listen("untag", this.img.bind(this));
    };
  }());

  // Associate an image with the item using the description as the file name
  golem.Item.img = function () {
    if (!this._img) {
      this._img = window.document.createElement("img");
      this._img.__item = this;
    }
    this._img.src = "img/%0.png".fmt(this.description());
    this._img.alt = this.description();
    return this;
  };

  // Apply a tap rule from the automaton
  golem.Item.tap = function (automaton) {
    automaton.apply(this);
  };

  // Apply a drag rule from the automaton
  golem.Item.drag = function (automaton, item) {
    automaton.apply(this, item);
  };

  golem.status = function (text) {
    return function () {
      golem.ui.status(text);
    };
  };

  golem.move = function (x, y) {
    return function (automaton, items) {
      golem.ui.move_item(automaton, items[x - 1], items[y - 1]);
    };
  };

  golem.remove = function (x) {
    return function (_, items) {
      items[x - 1].__parent.remove_child(items[x - 1]);
    };
  };

  golem.seq = function () {
    var args = Array.prototype.slice.call(arguments);
    return function (automaton, items) {
      args.forEach(function (f) {
        f(automaton, items);
      });
    };
  };

  golem.add_tag = function (x, tag) {
    return function (_, items) {
      items[x - 1].tag(tag);
    };
  }

  golem.ui = {
    status: function (text) {
      window.document.getElementById("status").innerHTML = text;
    },

    inventory: function (item) {
      window.document.getElementById("inventory").appendChild(item._img);
    },

    unitem: function (e) {
      if (e.source.tags.PC) {
        window.document.getElementById("inventory").removeChild(e.item._img);
      } else if (e.source.__div) {
        try {
          e.source.__div.removeChild(e.item._img);
        } catch (_) {}
      }
    },

    move_item: function (automaton, parent, item) {
      parent.append_child(item);
      if (item.tags.PC) {
        golem.ui.show_location(automaton, parent);
      } else if (parent.tags.PC) {
        golem.ui.inventory(item);
      }
    },

    show_location: function (automaton, item) {
      golem.ui.status(item.description());
      var div = window.document.getElementById("location");
      if (div.__item) {
        delete div.__item.__div;
      }
      div.__item = item;
      item.__div = div;
      div.innerHTML = "";
      item.__children.forEach(function (child) {
        var img = div.appendChild(child._img);
        var offset, x, y;
        img.addEventListener("mousedown", function (e) {
          e.preventDefault();
          var move = function (e) {
            img.classList.add("drag");
            x = (e.targetTouches ? e.targetTouches[0].clientX : e.clientX);
            y = e.targetTouches ? e.targetTouches[0].clientY : e.clientY;
            if (!offset) {
              offset = { x: x, y: y };
            }
            img.style.webkitTransform = img.style.mozTransform =
            img.style.transform =
              "translate(%0px, %1px)".fmt(x - offset.x, y - offset.y);
          };
          var up = function () {
            window.document.removeEventListener("mousemove", move);
            window.document.removeEventListener("mouseup", up);
            if (img.classList.contains("drag")) {
              img.classList.remove("drag");
              img.style.webkitTransform = img.style.mozTransform =
              img.style.transform = "";
              offset = false;
              var elem = window.document.elementFromPoint(x, y);
              if (elem && elem.__item) {
                child.drag(automaton, elem.__item);
              }
            } else {
              child.tap(automaton);
            }
          };
          window.document.addEventListener("mousemove", move);
          window.document.addEventListener("mouseup", up);
        });
      });
    }

  };


  // Create the automaton from the rules in <script> elements with the type
  // "x-golem/x-rules"
  var automaton = Array.prototype.filter
    .call(document.querySelectorAll("script"), function (script) {
      return script.type === "x-golem/x-rules";
    }).reduce(function (automaton, script) {
      return automaton.rules(script.textContent);
    }, golem.Automaton.create());

  console.log(automaton.toString());

}());
