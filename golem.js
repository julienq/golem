(function () {
  "use strict";

  if (typeof window === "object") {
    window.golem = {};
  } else if (typeof require === "function") {
    global.flexo = require("flexo");
    global.golem = exports;
  }

  golem.version = "0.1";


  golem.Object = flexo._ext(flexo.Object, {

    // Initialize a location with a name and no item.
    init: function (name) {
      flexo.Object.init.apply(this, arguments);
      this.name = flexo.safe_trim(name);
      this.items = [];
    },

    // Add an item to the location (removing it from its previous location if
    // necessary) and return it. An "item" event notification is generated.
    add_item: function (item) {
      if (item.location !== this) {
        this.items.push(item.detach());
        item.location = this;
        flexo.notify(this, "item", { item: item });
      }
      return item;
    },

    // Remove an item from this location and return it, generating an "unitem"
    // event notification in the process.
    remove_item: function (item) {
      item = flexo.remove_from_array(this.items, item);
      if (item) {
        delete item.location;
        flexo.notify(this, "unitem", { item: item });
        return item;
      }
    },

    // Add an item (or several) to the location and return the location.
    item: function () {
      flexo.foreach(arguments, this.add_item.bind(this));
      return this;
    }
  });

  flexo._accessor(golem.Object, "description", function (description) {
    return flexo.safe_trim(description) || this.name;
  });


  var Location = golem.Location = flexo._ext(golem.Object, {
  });


  var Item = golem.Item = flexo._ext(golem.Object, {

    // Initialize an item with a name an no tags.
    init: function () {
      golem.Object.init.apply(this, arguments);
      this.tags = {};
    },

    tag: function () {
      flexo.foreach(arguments, function (tag) {
        tag = flexo.safe_trim(tag);
        this.tags[tag] = true;
      }, this);
      return this;
    },

    detach: function () {
      if (this.location) {
        return this.location.remove_item(this);
      } else if (this.container) {
        return this.container.remove_item(this);
      }
      return this;
    }

  });

  flexo._accessor(Item, "description", function (description) {
    return flexo.safe_trim(description) ||
      this.name + Object.keys(this.tags).map(function (tag) {
        return "+" + tag;
      }).join("");
  });

  if (typeof require === "function") {
    var A = Location.create("A");
    console.log(A.description());
    var B = Location.create("B").description("Point B");
    console.log(B.description());
    var alice = Item.create("Alice").tag("PC");
    var door = Item.create("door");
    A.item(alice, door);
    console.log(A.items.map(function (item) { return item.description() }));
    door.tag("Open");
    B.item(alice);
    console.log(A.items.map(function (item) { return item.description() }),
      B.items.map(function (item) { return item.description() }));
  }

}());
