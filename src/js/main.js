'use strict';

import fb from "fancybox";
import $ from "jquery";
import sigma from "sigma-webpack"
import _ from "underscore";

// Using sigma-webpack version because GH dependency of sigma repo didn't work, and the last patch in master is needed
// in order to work with node. Otherwise, the container is not found.

fb($);

var _sigma;
let $GP;
let _nodesById;
let _neighbors;

$(document).ready(() => {
  $GP = {
    calculating: false,
  };
  $GP.info = $("#attributepane");
  $GP.info_donnees = $GP.info.find(".nodeattributes");
  $GP.info_name = $GP.info.find(".name");
  $GP.info_link = $GP.info.find(".link");
  $GP.info_data = $GP.info.find(".data");
  $GP.info_close = $GP.info.find(".returntext");
  $GP.info_close2 = $GP.info.find(".close");
  $GP.info_p = $GP.info.find(".p");
  $GP.info_close.click(showNormalMode);
  $GP.info_close2.click(showNormalMode);
  $GP.form = $("#mainpanel").find("form");
  $GP.search = new Search($GP.form.find("#search"));
  $GP.cluster = new Cluster($GP.form.find("#attributeselect"));

  initSigma();
});

function initSigma() {
  //noinspection JSPotentiallyInvalidConstructorUsage
  _sigma = new sigma({
    container: 'sigma-canvas',
    settings: {
      defaultEdgeType: "curve",
      defaultHoverLabelBGColor: "#002147",
      labelThreshold: 10,
      defaultLabelHoverColor: "#fff",
      fontStyle: "bold",
      hoverFontStyle: "bold"
    }
  });

  _sigma.active = false;
  _sigma.neighbors = {};
  _sigma.detail = false;

  $.getJSON('data.json', data => {
    //noinspection JSUnresolvedFunction
    _sigma.graph.read(data);

    //noinspection JSUnresolvedFunction
    _nodesById = _.chain(_sigma.graph.nodes())
      .groupBy(node => node.id)
      .mapObject(nodes => nodes[0])
      .value();

    loadNeighbors();

    //noinspection JSUnresolvedFunction
    _sigma.clusters = _.chain(_sigma.graph.nodes())
      .groupBy(node => node.color)
      .mapObject(nodes => _.map(nodes, node => node.id))
      .value();

    //noinspection JSUnresolvedFunction
    _sigma.bind("clickNode", event => showActiveMode(event.data.node));

    configSigmaElements();

    //noinspection JSUnresolvedFunction
    _sigma.refresh();
  });
}

function loadNeighbors() {
  let adjacencies = getAdjacencies();
  let incidents = getIncidents();

  //noinspection JSUnresolvedFunction
  _neighbors = _.mapObject(adjacencies, (nodes, id) => nodes.concat(incidents[id]));

  console.log(_neighbors);
}

function getAdjacencies() {
  //noinspection JSUnresolvedFunction
  let adjacencies = _.chain(_sigma.graph.edges())
    .groupBy(edge => edge.source)
    .mapObject(edges => _.map(edges, edge => _nodesById[edge.target]))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(_sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in adjacencies)
    .each(id => adjacencies[id] = []);

  return adjacencies;
}

function getIncidents() {
  //noinspection JSUnresolvedFunction
  let incidents = _.chain(_sigma.graph.edges())
    .groupBy(edge => edge.target)
    .mapObject(edges => _.map(edges, edge => _nodesById[edge.source]))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(_sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in incidents)
    .each(id => incidents[id] = []);

  return incidents;
}

function configSigmaElements() {
  let clustersHtml = [];
  let clusterNumber = 1;
  for (let clusterId of Object.keys(_sigma.clusters)) {
    clustersHtml.push(`<div style="line-height:12px"><a href="#${clusterId}"><div style="width:40px;height:12px;
      border:1px solid #fff;background:${clusterId};display:inline-block"></div>
      Group ${clusterNumber++} (${clusterId.length} members)</a></div>`);
  }
  $GP.cluster.content(clustersHtml.join(""));

  //noinspection JSUnresolvedFunction
  $("a.fb").fancybox({
    minWidth: 400,
    maxWidth: 800,
    maxHeight: 600,
  });

  $("#zoom").find("div.z").each(() => {
    let rel = $(this).attr("rel");
    $(this).click(() => {
      if (rel == "center") {
        //noinspection JSUnresolvedFunction
        _sigma.cameras.goTo(0, 0, 1, 0);
      } else {
        //noinspection JSUnresolvedFunction
        _sigma.utils.zoomTo(0, 0, "in" == rel ? 1.5 : 0.5, 0);
      }
    });
  });

  let hashAnchor = window.location.hash.substr(1);
  if (hashAnchor.length > 0) {
    switch (hashAnchor) {
      case "information":
        $.fancybox.open($("#information"), "Esta visualización muestra las donaciones recibidas declaradas por los" +
          " partidos políticos para cada una de las listas políticas en las Elecciones Nacionales uruguayas del año" +
          " 2014. El tamaño de los nodos es proporcional al dinero recibido.\n\nLos puntos rojos representan listas a" +
          " la presidencia, los verdes candidatos a diputado y los amarillos a senador. Por otro lado, las empresas" +
          " donantes están en azul y los particulares en color celeste.");
        break;
      default:
        $GP.search.exactMatch = $GP.search.search(hashAnchor);
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
  this.input.focus(() => {
    if (!$(this).data("focus")) {
      $(this).data("focus", true);
      $(this).removeClass("empty");
    }
    this.clean();
  });
  this.input.keydown(event => {
    if (event.which == 13) {
      this.state.addClass("searching");
      this.search(this.input.val());
    }
  });
  this.state.click(() => {
    let stateValue = this.input.val();
    if (this.searching && stateValue == this.lastSearch) {
      this.close();
    } else {
      this.state.addClass("searching");
      this.search(stateValue);
    }
  });
  this.close = () => {
    this.state.removeClass("searching");
    this.results.hide();
    this.searching = false;
    this.input.val("");
    showNormalMode();
  };
  this.clean = () => {
    this.results.empty().hide();
    this.state.removeClass("searching");
    this.input.val("");
  };
  this.search = text => {
    let foundNodes = [];
    let textRegex = new RegExp(this.exactMatch ? ("^" + text + "$").toLowerCase() : text.toLowerCase());
    this.exactMatch = false;
    this.searching = true;
    this.lastSearch = text;
    this.results.empty();
    if (text.length <= 2) {
      this.results.html("<i>El texto a buscar debe contener al menos 3 letras.</i>");
    } else {
      //noinspection JSUnresolvedFunction
      for (let node of _sigma.graph.nodes()) {
        if (textRegex.test(node.label.toLowerCase())) {
          foundNodes.push(node);
        }
      }
      let output = ["<b>Resultados encontrados: </b>"];
      if (foundNodes.length == 0) {
        if (!showCluster(text)) {
          output.push("<i>No se encontró ningún nodo.</i>");
        }
      } else {
        showActiveMode(foundNodes[0].id);
        if (foundNodes.length > 1) {
          for (let foundNode of foundNodes) {
            output.push(`<a href="#${foundNode.label}" onclick="showActiveMode('${foundNode.id}')">${foundNode.label}</a>`);
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
  this.content = html => {
    this.list.html(html);
    this.list.find("a").click(() => showCluster($(this).attr("href").substr(1)));
  };
  this.hide = () => {
    this.display = false;
    this.list.hide();
    this.select.removeClass("close");
  };
  this.show = () => {
    this.display = true;
    this.list.show();
    this.select.addClass("close");
  }
}

function showNormalMode() {
  if (!$GP.calculating && _sigma.detail) {
    $GP.calculating = true;
    _sigma.detail = true;
    //noinspection JSUnresolvedFunction
    $GP.info.delay(400).animate({width: 'hide'}, 350);
    $GP.cluster.hide();
    //noinspection JSUnresolvedFunction
    for (let edge of _sigma.graph.edges()) {
      edge.attributes.color = false;
      edge.hidden = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of _sigma.graph.nodes()) {
      node.hidden = false;
      node.attributes.color = false;
      node.attributes.lineWidth = false;
      node.attributes.size = false
    }
    //_sigma.draw(2, 2, 2, 2);
    //noinspection JSUnresolvedFunction
    _sigma.refresh();
    _sigma.neighbors = {};
    _sigma.active = false;
    $GP.calculating = false;
    window.location.hash = "";
  }
}

function showActiveMode(node) {
  _sigma.detail = true;
  //noinspection JSUnresolvedFunction
  for (let edge of _sigma.graph.edges()) {
    edge.attributes.lineWidth = false;
    edge.attributes.color = "rgb(0, 0, 0)";
  }

  //noinspection JSUnresolvedFunction
  for (let node2 of _sigma.graph.nodes()) {
    node2.hidden = true;
    node2.attributes.lineWidth = false;
    node2.attributes.color = node2.color;
  }

  let createList = neighborsAndNodeMap => {
    let neighborsHtmlList = [];
    let neighbors = [];
    for (let neighborId of neighborsAndNodeMap) {
      let neighbor = _nodesById[neighborId];
      neighbor.hidden = false;
      neighbor.attributes.lineWidth = false;
      neighbor.attributes.color = neighborsAndNodeMap[neighborId].color;
      if (neighborId != node.id) {
        neighbors.push({
          id: neighborId,
          label: neighbor.label,
          group: neighborsAndNodeMap[neighborId].label,
          color: neighborsAndNodeMap[neighborId].color
        });
      }
    }
    neighbors.sort((node1, node2) => node1.group.toLowerCase().localeCompare(node2.group.toLowerCase())
        || node1.label.toLowerCase().localeCompare(node2.label.toLowerCase()));
    for (neighbor in neighbors) {
      neighborsHtmlList.push(`<li class="membership"><!--suppress JSUnresolvedFunction -->
        <a href="#${neighbor.label}" onclick="showActiveMode('${neighbor.id}')"
        onmouseout="_sigma.refresh()">${neighbor.label}</a></li>`);
    }
    return neighborsHtmlList;
  };

  let neighborsHtml = [].concat(createList(_sigma.neighbors));

  node.hidden = false;
  node.attributes.color = node.color;
  node.attributes.lineWidth = 6;
  node.attributes.strokeStyle = "#000000";

  //noinspection JSUnresolvedFunction
  _sigma.refresh();

  $GP.info_link.find("ul").html(neighborsHtml.join(""));

  if (node.attributes) {
    let attributesHtml = [];
    for (let attr of node.attributes) {
      if (attr != false) {
        attributesHtml.push('<span><strong>' + attr + ':</strong> ' + attr + '</span><br/>');
      }
    }

    $GP.info_name.html('<div><!--suppress JSUnresolvedFunction --><span onmouseout="_sigma.refresh()">'
      + node.label + "</span></div>");

    $GP.info_data.html(attributesHtml.join("<br/>"));
  }
  $GP.info_data.show();
  $GP.info_p.html("Conexiones:");
  $GP.info.animate({width: 'show'}, 350);
  $GP.info_donnees.hide();
  $GP.info_donnees.show();
  _sigma.active = node.id;
  window.location.hash = node.label;
}

function showCluster(clusterName) {
  let cluster = _sigma.clusters[clusterName];
  if (cluster.length > 0) {
    _sigma.detail = true;
    cluster.sort();
    //noinspection JSUnresolvedFunction
    for (let edge of _sigma.graph.edges()) {
      edge.hidden = false;
      edge.attributes.lineWidth = false;
      edge.attributes.color = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of _sigma.graph.nodes()) {
      node.hidden = true;
    }
    let clusterHiddenNodesHtmlList = [];
    let clusterHiddenNodesIds = [];
    for (let clusterNodeId of cluster) {
      let clusterNode = _nodesById[clusterNodeId];
      if (clusterNode.hidden) {
        clusterHiddenNodesIds.push(clusterNodeId);
        clusterNode.hidden = false;
        clusterNode.attributes.lineWidth = false;
        clusterNode.attributes.color = clusterNode.color;
        clusterHiddenNodesHtmlList.push(`<li class="membership"><!--suppress JSUnresolvedFunction --><a href="#
          ${clusterNode.label}" onclick="showActiveMode('${clusterNode.id}')" onmouseout="_sigma.refresh()">
          ${clusterNode.label}</a></li>`);
      }
    }
    _sigma.clusters[clusterName] = clusterHiddenNodesIds;
    //noinspection JSUnresolvedFunction
    _sigma.refresh();
    $GP.info_name.html("<b>" + clusterName + "</b>");
    $GP.info_data.hide();
    $GP.info_p.html("Miembros del grupo:");
    $GP.info_link.find("ul").html(clusterHiddenNodesHtmlList.join(""));
    $GP.info.animate({width: 'show'}, 350);
    $GP.search.clean();
    $GP.cluster.hide();
    return true;
  }
  return false;
}
