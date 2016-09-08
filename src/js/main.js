'use strict';

import sigma from "sigma";
import $ from "jquery";
import "fancybox";

var _sigma;
var $GP;

$(document).ready(() => {
  $.getJSON("config.json", data => {
    var config = data;

    if (config.type != "network") {
      alert("Invalid configuration settings.");
      return;
    }

    setupGUI(config);
  });
});

Object.size = obj => {
  var size = 0;
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      size++;
    }
  }
  return size;
};

function setupGUI(config) {
  var logo = "";
  if (config.logo.file) {
    logo = "<img src=\"" + config.logo.file + "\"";
    if (config.logo.text) {
      logo += " alt=\"" + config.logo.text + "\"";
    }
    logo += ">";
  } else if (config.logo.text) {
    logo = "<h1>" + config.logo.text + "</h1>";
  }
  if (config.logo.link) {
    logo = "<a href=\"" + config.logo.link + "\">" + logo + "</a>";
  }
  $("#maintitle").html(logo);

  $("#title").html("<h2>" + config.text.title + "</h2>");

  $("#titletext").html(config.text.intro);

  if (config.text.more) {
    $("#information").html(config.text.more);
  } else {
    //hide more information link
    $("#moreinformation").hide();
  }


  if (config.legend.nodeLabel) {
    $(".node").next().html(config.legend.nodeLabel);
  } else {
    $(".node").hide();
  }

  if (config.legend.edgeLabel) {
    $(".edge").next().html(config.legend.edgeLabel);
  } else {
    $(".edge").hide();
  }

  if (config.legend.nodeLabel) {
    $(".colours").next().html(config.legend.colorLabel);
  } else {
    $(".colours").hide();
  }

  $GP = {
    calculating: false,
    showgroup: false
  };
  $GP.intro = $("#intro");
  $GP.minifier = $GP.intro.find("#minifier");
  $GP.mini = $("#minify");
  $GP.info = $("#attributepane");
  $GP.info_donnees = $GP.info.find(".nodeattributes");
  $GP.info_name = $GP.info.find(".name");
  $GP.info_link = $GP.info.find(".link");
  $GP.info_data = $GP.info.find(".data");
  $GP.info_close = $GP.info.find(".returntext");
  $GP.info_close2 = $GP.info.find(".close");
  $GP.info_p = $GP.info.find(".p");
  $GP.info_close.click(nodeNormal);
  $GP.info_close2.click(nodeNormal);
  $GP.form = $("#mainpanel").find("form");
  $GP.search = new Search($GP.form.find("#search"));
  if (!config.features.search) {
    $("#search").hide();
  }
  if (!config.features.groupSelectorAttribute) {
    $("#attributeselect").hide();
  }
  $GP.cluster = new Cluster($GP.form.find("#attributeselect"));
  config.GP = $GP;
  initSigma(config);
}

function initSigma(config) {
  //noinspection JSPotentiallyInvalidConstructorUsage
  _sigma = new sigma({
    container: $('#sigma-canvas'),
    settings: 'config.sigma.settings'
  });

  _sigma.active = false;
  _sigma.neighbors = {};
  _sigma.detail = false;

  $.getJSON(config.data, data => {
    _sigma.graph.read(data);

    _sigma.clusters = {};

    for (var node of _sigma.graph.nodes()) {
      if (!_sigma.clusters[node.color]) {
        _sigma.clusters[node.color] = [];
      }
      _sigma.clusters[node.color].push(node.id);
    }

    _sigma.bind("upNodes", node => nodeActive(node.content[0]));

    configSigmaElements(config);

    _sigma.refresh();
  });
}

function configSigmaElements(config) {
  $GP = config.GP;

  if (config.features.hoverBehavior == "dim") {
    var greyColor = '#ccc';
    _sigma.bind('overNodes', event => {
      var nodes = event.content;
      var neighbors = {};

      for (var edge of _sigma.graph.edges()) {
        if (nodes.indexOf(edge.source) < 0 && nodes.indexOf(edge.target) < 0) {
          if (!edge.attr['grey']) {
            edge.attr['true_color'] = edge.color;
            edge.color = greyColor;
            edge.attr['grey'] = 1;
          }
        } else {
          edge.color = edge.attr['grey'] ? edge.attr['true_color'] : edge.color;
          edge.attr['grey'] = 0;

          neighbors[edge.source] = 1;
          neighbors[edge.target] = 1;
        }
      }

      for (var node of _sigma.graph.nodes()) {
        if (neighbors[node.id]) {
          node.color = node.attr['grey'] ? node.attr['true_color'] : node.color;
          node.attr['grey'] = 0;
        } else if (!node.attr['grey']) {
          node.attr['true_color'] = node.color;
          node.color = greyColor;
          node.attr['grey'] = 1;
        }
      }
    });

    _sigma.bind('outNodes', () => {
      for (var edge of _sigma.graph.edges()) {
        edge.color = edge.attr['grey'] ? edge.attr['true_color'] : edge.color;
        edge.attr['grey'] = 0;
      }

      for (var node of _sigma.graph.nodes()) {
        node.color = node.attr['grey'] ? node.attr['true_color'] : node.color;
        node.attr['grey'] = 0;
      }
    });
  } else if (config.features.hoverBehavior == "hide") {
    _sigma.bind('overNodes', event => {
      var nodes = event.content;
      var neighbors = {};
      for (var edge of _sigma.graph.edges()) {
        if (nodes.indexOf(edge.source) >= 0 || nodes.indexOf(edge.target) >= 0) {
          neighbors[edge.source] = 1;
          neighbors[edge.target] = 1;
        }
      }

      for (var node of _sigma.graph.nodes()) {
        node.hidden = neighbors[node.id] ? 0 : 1;
      }
    });

    _sigma.bind('outNodes', () => {
      for (var edge of _sigma.graph.edges()) {
        edge.hidden = 0;
      }

      for (var node of _sigma.graph.nodes()) {
        node.hidden = 0;
      }
    });
  }
  $GP.bg = $(_sigma._core.domElements.bg);
  $GP.bg2 = $(_sigma._core.domElements.bg2);
  var target = [];
  var x = 1;
  for (var cluster of _sigma.clusters) {
    target.push('<div style="line-height:12px"><a href="#' + cluster + '"><div style="width:40px;height:12px;'
      + 'border:1px solid #fff;background:' + cluster + ';display:inline-block"></div>'
      + ' Group ' + (x++) + ' (' + cluster.length + ' members)</a></div>');
  }
  $GP.cluster.content(target.join(""));
  cluster = {
    minWidth: 400,
    maxWidth: 800,
    maxHeight: 600,
  };
  $("a.fb").fancybox(cluster);
  $("#zoom").find("div.z").each(() => {
    var jq = $(this);
    var rel = jq.attr("rel");
    jq.click(() => {
      if (rel == "center") {
        _sigma.position(0, 0, 1).draw();
      } else {
        var core = _sigma._core;
        _sigma.zoomTo(core.domElements.nodes.width / 2, core.domElements.nodes.height / 2,
          core.mousecaptor.ratio * ("in" == rel ? 1.5 : 0.5));
      }
    })
  });
  $GP.mini.click(() => {
    $GP.mini.hide();
    $GP.intro.show();
    $GP.minifier.show()
  });
  $GP.minifier.click(() => {
    $GP.intro.hide();
    $GP.minifier.hide();
    $GP.mini.show()
  });
  $GP.intro.find("#showGroups").click(() => $GP.showgroup ? showGroups(false) : showGroups(true));
  target = window.location.hash.substr(1);
  if (0 < target.length) {
    switch (target) {
      case "Groups":
        showGroups(true);
        break;
      case "information":
        $.fancybox.open($("#information"), cluster);
        break;
      default:
        $GP.search.exactMatch = $GP.search.search(target);
        $GP.search.clean();
    }
  }
}

function Search(searchElem) {
  this.input = searchElem.find("input[name=search]");
  this.state = searchElem.find(".state");
  this.results = searchElem.find(".results");
  this.exactMatch = false;
  this.lastSearch = "";
  this.searching = false;
  var b = this;
  this.input.focus(() => {
    var a = $(this);
    if (!a.data("focus")) {
      a.data("focus", true);
      a.removeClass("empty");
    }
    b.clean();
  });
  this.input.keydown(a => {
    if (a.which == 13) {
      b.state.addClass("searching");
      b.search(b.input.val());
      return false;
    }
  });
  this.state.click(() => {
    var a = b.input.val();
    if (b.searching && a == b.lastSearch) {
      b.close()
    } else {
      b.state.addClass("searching");
      b.search(a);
    }
  });
  this.close = () => {
    this.state.removeClass("searching");
    this.results.hide();
    this.searching = false;
    this.input.val("");//SAH -- let's erase string when we close
    nodeNormal();
  };
  this.clean = () => {
    this.results.empty().hide();
    this.state.removeClass("searching");
    this.input.val("");
  };
  this.search = text => {
    var foundNodes = [];
    var textRegex = new RegExp(this.exactMatch ? ("^" + text + "$").toLowerCase() : text.toLowerCase());
    this.exactMatch = false;
    this.searching = true;
    this.lastSearch = text;
    this.results.empty();
    if (text.length <= 2) {
      this.results.html("<i>El texto a buscar debe contener al menos 3 letras.</i>");
    } else {
      _sigma.iterNodes(node => {
        if (textRegex.test(node.label.toLowerCase())) {
          foundNodes.push({
            id: node.id,
            name: node.label
          });
        }
      });
      var output = ["<b>Resultados encontrados: </b>"];
      if (foundNodes.length == 0) {
        if (!showCluster(text)) {
          output.push("<i>No se encontró ningún nodo.</i>");
        }
      } else {
        nodeActive(foundNodes[0].id);
        if (foundNodes.length > 1) {
          for (var node in foundNodes) {
            output.push('<a href="#' + node.name + '" onclick="nodeActive(\'' + node.id + "')\">" + node.name + "</a>");
          }
        }
      }
      this.results.html(output.join(""));
    }
    foundNodes.length == 1 ? this.results.hide() : this.results.show();
  }
}

function Cluster(clusterElem) {
  this.cluster = clusterElem;
  this.display = false;
  this.list = this.cluster.find(".list");
  this.list.empty();
  this.select = this.cluster.find(".select");
  this.select.click(() => $GP.cluster.toggle());
  this.toggle = () => this.display ? this.hide() : this.show();
  this.content = a => {
    this.list.html(a);
    this.list.find("a").click(() => {
      var a = $(this).attr("href").substr(1);
      showCluster(a);
    })
  };
  this.hide = () => {
    this.display = false;
    this.list.hide();
    this.select.removeClass("close")
  };
  this.show = () => {
    this.display = true;
    this.list.show();
    this.select.addClass("close")
  }
}

function showGroups(a) {
  if (a) {
    $GP.intro.find("#showGroups").text("Hide groups");
    $GP.bg.show();
    $GP.bg2.hide();
    $GP.showgroup = true
  } else {
    $GP.intro.find("#showGroups").text("View Groups");
    $GP.bg.hide();
    $GP.bg2.show();
    $GP.showgroup = false;
  }
}

function nodeNormal() {
  if (!$GP.calculating && _sigma.detail && showGroups(false)) {
    $GP.calculating = true;
    _sigma.detail = true;
    $GP.info.delay(400).animate({width: 'hide'}, 350);
    $GP.cluster.hide();
    _sigma.iterEdges(a => {
      a.attr.color = false;
      a.hidden = false
    });
    _sigma.iterNodes(a => {
      a.hidden = false;
      a.attr.color = false;
      a.attr.lineWidth = false;
      a.attr.size = false
    });
    _sigma.draw(2, 2, 2, 2);
    _sigma.neighbors = {};
    _sigma.active = false;
    $GP.calculating = false;
    window.location.hash = "";
  }
}

function nodeActive(a) {
  var groupByDirection = config.informationPanel.groupByEdgeDirection;

  _sigma.neighbors = {};
  _sigma.detail = true;
  var b = _sigma._core.graph.nodesIndex[a];
  showGroups(false);
  var outgoing = {}, incoming = {}, mutual = {};//SAH
  _sigma.iterEdges(b => {
    b.attr.lineWidth = false;
    b.hidden = true;

    var n = {
      name: b.label,
      colour: b.color
    };

    if (a == b.source) {
      outgoing[b.target] = n; //SAH
    } else if (a == b.target) {
      incoming[b.source] = n; //SAH
    }
    if (a == b.source || a == b.target) {
      _sigma.neighbors[a == b.target ? b.source : b.target] = n;
    }
    b.hidden = false;
    b.attr.color = "rgba(0, 0, 0, 1)";
  });
  _sigma.iterNodes(node => {
    node.hidden = true;
    node.attr.lineWidth = false;
    node.attr.color = node.color;
  });

  if (groupByDirection) {
    //SAH - Compute intersection for mutual and remove these from incoming/outgoing
    for (e in outgoing) {
      if (e in incoming) {
        mutual[e] = outgoing[e];
        delete incoming[e];
        delete outgoing[e];
      }
    }
  }

  var createList = c => {
    var f = [];
    var e = [];
    for (var g in c) {
      var d = _sigma._core.graph.nodesIndex[g];
      d.hidden = false;
      d.attr.lineWidth = false;
      d.attr.color = c[g].colour;
      if (a != g) {
        e.push({
          id: g,
          name: d.label,
          group: (c[g].name) ? c[g].name : "",
          colour: c[g].colour
        })
      }
    }
    e.sort((a, b) => {
      var c = a.group.toLowerCase(),
        d = b.group.toLowerCase(),
        e = a.name.toLowerCase(),
        f = b.name.toLowerCase();
      return c != d ? c < d ? -1 : c > d ? 1 : 0 : e < f ? -1 : e > f ? 1 : 0
    });
    for (g in e) {
      c = e[g];
      /*if (c.group != d) {
       d = c.group;
       f.push('<li class="cf" rel="' + c.color + '"><div class=""></div><div class="">' + d + "</div></li>");
       }*/
      f.push('<li class="membership"><a href="#' + c.name + '" onmouseover="_sigma._core.plotter.drawHoverNode(_sigma._core.graph.nodesIndex[\'' + c.id + '\'])\" onclick=\"nodeActive(\'' + c.id + '\')" onmouseout="_sigma.refresh()">' + c.name + "</a></li>");
    }
    return f;
  };

  var f = [];

  var size;
  if (groupByDirection) {
    size = Object.size(mutual);
    f.push("<h2>Mutual (" + size + ")</h2>");
    (size > 0) ? f = f.concat(createList(mutual)) : f.push("No mutual links<br>");
    size = Object.size(incoming);
    f.push("<h2>Incoming (" + size + ")</h2>");
    (size > 0) ? f = f.concat(createList(incoming)) : f.push("No incoming links<br>");
    size = Object.size(outgoing);
    f.push("<h2>Outgoing (" + size + ")</h2>");
    (size > 0) ? f = f.concat(createList(outgoing)) : f.push("No outgoing links<br>");
  } else {
    f = f.concat(createList(_sigma.neighbors));
  }
  //b is object of active node -- SAH
  b.hidden = false;
  b.attr.color = b.color;
  b.attr.lineWidth = 6;
  b.attr.strokeStyle = "#000000";
  _sigma.draw(2, 2, 2, 2);

  $GP.info_link.find("ul").html(f.join(""));
  f = b.attr;
  var e;
  if (f.attributes) {
    var image_attribute = false;
    if (config.informationPanel.imageAttribute) {
      image_attribute = config.informationPanel.imageAttribute;
    }
    e = [];
    g = 0;
    for (var attr in f.attributes) {
      var h = "";
      if (attr != image_attribute) {
        h = '<span><strong>' + attr + ':</strong> ' + attr + '</span><br/>'
      }
      //temp_array.push(f.attributes[g].attr);
      e.push(h);
    }

    if (image_attribute) {
      //image_index = jQuery.inArray(image_attribute, temp_array);
      $GP.info_name.html("<div><img src=" + f.attributes[image_attribute] + " style=\"vertical-align:middle\" /> <span onmouseover=\"_sigma._core.plotter.drawHoverNode(_sigma._core.graph.nodesIndex['" + b.id + '\'])" onmouseout="_sigma.refresh()">' + b.label + "</span></div>");
    } else {
      $GP.info_name.html("<div><span onmouseover=\"_sigma._core.plotter.drawHoverNode(_sigma._core.graph.nodesIndex['" + b.id + '\'])" onmouseout="_sigma.refresh()">' + b.label + "</span></div>");
    }
    // Image field for attribute pane
    $GP.info_data.html(e.join("<br/>"))
  }
  $GP.info_data.show();
  $GP.info_p.html("Connections:");
  $GP.info.animate({width: 'show'}, 350);
  $GP.info_donnees.hide();
  $GP.info_donnees.show();
  _sigma.active = a;
  window.location.hash = b.label;
}

function showCluster(a) {
  var b = _sigma.clusters[a];
  if (b && 0 < b.length) {
    showGroups(false);
    _sigma.detail = true;
    b.sort();
    _sigma.iterEdges(edge => {
      edge.hidden = false;
      edge.attr.lineWidth = false;
      edge.attr.color = false
    });
    _sigma.iterNodes(node => node.hidden = true);
    for (var f = [], e = [], c = 0; c < b.length; c++) {
      var d = _sigma._core.graph.nodesIndex[b[c]];
      if (d.hidden) {
        e.push(b[c]);
        d.hidden = false;
        d.attr.lineWidth = false;
        d.attr.color = d.color;
        f.push('<li class="membership"><a href="#' + d.label
          + '" onmouseover="_sigma._core.plotter.drawHoverNode(_sigma._core.graph.nodesIndex[\''
          + d.id + "'])\" onclick=\"nodeActive('" + d.id + '\')" onmouseout="_sigma.refresh()">'
          + d.label + "</a></li>");
      }
    }
    _sigma.clusters[a] = e;
    _sigma.draw(2, 2, 2, 2);
    $GP.info_name.html("<b>" + a + "</b>");
    $GP.info_data.hide();
    $GP.info_p.html("Group Members:");
    $GP.info_link.find("ul").html(f.join(""));
    $GP.info.animate({width: 'show'}, 350);
    $GP.search.clean();
    $GP.cluster.hide();
    return true;
  }
  return false;
}
