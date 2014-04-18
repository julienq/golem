function make_items(descriptions, make_image) {
  var items = {};
  descriptions.split(" ").forEach(function (description) {
    var tags = description.split("+");
    var name = tags.shift();
    var item = items[name] = golem.Item.tag.apply(golem.Item.create(name),
      tags);
    if (make_image) {
      item.img();
    }
    item.listen("unitem", unitem);
    item.listen("tag", item.img.bind(item));
    item.listen("untag", item.img.bind(item));
  });
  return items;
}

golem.Item.img = function () {
  if (!this._img) {
    this._img = document.createElement("img");
    this._img.__item = this;
  }
  this._img.src = "img/%0.png".fmt(this.description());
  this._img.alt = this.description();
  return this;
};

golem.Item.tap = function () {
  status("Nothing happens.");
}

golem.Item.drag = function () {
  status("Nothing happens.");
}

function status(text) {
  document.getElementById("status").innerHTML = text;
}

function inventory(item) {
  document.getElementById("inventory").appendChild(item._img);
}

function unitem(e) {
  if (e.source.tags.PC) {
    document.getElementById("inventory").removeChild(e.item._img);
  } else if (e.source.__div) {
    try {
      e.source.__div.removeChild(e.item._img);
    } catch (_) {}
  }
}

function move_item(item, parent) {
  parent.append_child(item);
  if (item.tags.PC) {
    show_location(parent);
  } else if (parent.tags.PC) {
    inventory(item);
  }
}

function show_location(item) {
  status(item.description());
  var div = document.getElementById("location");
  if (div.__item) {
    delete div.__item.__div
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
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        if (img.classList.contains("drag")) {
          img.classList.remove("drag");
          img.style.webkitTransform = img.style.mozTransform =
          img.style.transform = "";
          offset = false;
          setTimeout(function () {
            var elem = document.elementFromPoint(x, y);
            if (elem && elem.__item) {
              child.drag(elem.__item);
            }
          }, 0);
        } else {
          child.tap();
        }
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  });
}


var items = make_items(
  "Alice+PC stone hole cavity door opening fountain treasure doorway", true
);


items.Alice.tap = function () {
  status("You are Alice, the famous explorer.");
};

items.Alice.drag = function (item) {
  if (item === items.hole) {
    move_item(this, locations.Tunnel);
  } else if (item === items.opening) {
    if (item.tags.Reversed) {
      item.untag("Reversed");
      move_item(item, locations.Tunnel);
      move_item(this, locations.Tunnel);
    } else {
      item.tag("Reversed");
      move_item(item, locations.Chamber);
      move_item(this, locations.Chamber);
    }
  } else if (item === items.door && item.tags.Open) {
    move_item(this, locations.TreasureRoom);
  } else if (item === items.doorway) {
    move_item(this, locations.Tunnel);
  } else {
    golem.Item.drag.call(this);
  }
};


items.stone.tap = function () {
  status("A plain looking stone.");
};

items.stone.drag = function (item) {
  if (item.tags.PC) {
    move_item(this, item);
  } else if (item === items.hole) {
    move_item(this, locations.Tunnel);
  } else if (item === items.fountain) {
    this.tag("Glowing");
    status("The stone now emits a warm glow.");
  } else if (item === items.cavity) {
    item.tag(this.tags.Glowing ? "Glowing" : "Filled");
    if (this.tags.Glowing) {
      item.tag("Glowing");
      items.door.tag("Open");
      status("The stone door opens with a mighty sound.");
    } else {
      item.tag("Filled");
      status("The stone is stuck in the cavity.");
    }
    this.__parent.remove_child(this);
  } else {
    golem.Item.drag.call(this);
  }
};


items.hole.tap = function () {
  status("There seems to be a dark tunnel below.");
};


items.cavity.tap = function () {
  status("A small cavity in the rock.");
};


items.door.tap = function () {
  status("A massive stone door.");
};


items.opening.tap = function () {
  status("A small opening.");
};


items.fountain.tap = function () {
  status("The water is refreshing.");
};


items.treasure.tap = function ()  {
  status("The coveted idol will bring you fame and fortune.");
};

items.treasure.drag = function (item) {
  if (item.tags.PC) {
    move_item(this, item);
    won();
  } else {
    golem.Item.drag.call(this);
  }
};


var locations = make_items("Cave Tunnel Chamber TreasureRoom");

locations.Cave.item(items.Alice, items.stone, items.hole)
  .description("A mysterious cave.");
locations.Tunnel.item(items.cavity, items.door, items.opening)
  .description("A dark tunnel"),
locations.Chamber.item(items.fountain).description("A small chamber.");
locations.TreasureRoom.item(items.treasure, items.doorway)
  .description("Finally, the treasure room.");

show_location(locations.Cave);

function won() {
  status("You win!");
  alert("You win!");
}
