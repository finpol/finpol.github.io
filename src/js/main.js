'use strict';

import sigma from "sigma";
import $ from "jquery";
import fb from "fancybox";

fb($);

let _sigma;
let $GP;

$(document).ready(() => setupGUI());

function setupGUI() {
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
  $GP.info_close.click(nodeNormal);
  $GP.info_close2.click(nodeNormal);
  $GP.form = $("#mainpanel").find("form");
  $GP.search = new Search($GP.form.find("#search"));
  $GP.cluster = new Cluster($GP.form.find("#attributeselect"));
  initSigma();
}

function initSigma() {
  //noinspection JSPotentiallyInvalidConstructorUsage
  _sigma = new sigma({
    container: $('#sigma-canvas'),
    settings: {
      defaultEdgeType: "curve",
      defaultHoverLabelBGColor: "#002147",
      labelThreshold: 10,
      defaultLabelHoverColor: "#fff",
      fontStyle: "bold",
      hoverFontStyle: "bold",
      zoomMax: 20,
      zoomMin: 0.75
    }
  });

  _sigma.active = false;
  _sigma.neighbors = {};
  _sigma.detail = false;

  $.getJSON('data.json', data => {
    //noinspection JSUnresolvedFunction
    _sigma.graph.read(data);

    _sigma.clusters = {};

    //noinspection JSUnresolvedFunction
    for (let node of _sigma.graph.nodes()) {
      if (!(node.color in _sigma.clusters)) {
        _sigma.clusters[node.color] = [];
      }
      _sigma.clusters[node.color].push(node.id);
    }

    //noinspection JSUnresolvedFunction
    _sigma.bind("clickNode", event => nodeActive(event.data.node));

    configSigmaElements();

    //noinspection JSUnresolvedFunction
    _sigma.refresh();
  });
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
    nodeNormal();
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
        nodeActive(foundNodes[0].id);
        if (foundNodes.length > 1) {
          for (let foundNode of foundNodes) {
            output.push(`<a href="#${foundNode.label}" onclick="nodeActive('${foundNode.id}')">${foundNode.label}</a>`);
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

function nodeNormal() {
  if (!$GP.calculating && _sigma.detail) {
    $GP.calculating = true;
    _sigma.detail = true;
    //noinspection JSUnresolvedFunction
    $GP.info.delay(400).animate({width: 'hide'}, 350);
    $GP.cluster.hide();
    //noinspection JSUnresolvedFunction
    for (let edge of _sigma.graph.edges()) {
      edge.attr.color = false;
      edge.hidden = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of _sigma.graph.nodes()) {
      node.hidden = false;
      node.attr.color = false;
      node.attr.lineWidth = false;
      node.attr.size = false
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

function nodeActive(nodeId) {
  _sigma.neighbors = {};
  _sigma.detail = true;
  let node = _sigma.graph.nodesIndex[nodeId];
  let outgoing = {};
  let incoming = {};
  //noinspection JSUnresolvedFunction
  for (let edge of _sigma.graph.edges()) {
    edge.attr.lineWidth = false;
    edge.hidden = true;

    let n = {
      name: edge.label,
      color: edge.color
    };

    if (nodeId == edge.source) {
      outgoing[edge.target] = n;
    } else if (nodeId == edge.target) {
      incoming[edge.source] = n;
    }
    if (nodeId == edge.source || nodeId == edge.target) {
      _sigma.neighbors[nodeId == edge.target ? edge.source : edge.target] = n;
    }
    edge.hidden = false;
    edge.attr.color = "rgba(0, 0, 0, 1)";
  }
  //noinspection JSUnresolvedFunction
  for (let otherNode of _sigma.graph.nodes()) {
    otherNode.hidden = true;
    otherNode.attr.lineWidth = false;
    otherNode.attr.color = otherNode.color;
  }

  let createList = neighborsAndNodeIds => {
    let neighborsHtmlList = [];
    let neighbors = [];
    for (let neighborId of neighborsAndNodeIds) {
      let neighbor = _sigma.graph.nodesIndex[neighborId];
      neighbor.hidden = false;
      neighbor.attr.lineWidth = false;
      neighbor.attr.color = neighborsAndNodeIds[neighborId].color;
      if (neighborId != nodeId) {
        neighbors.push({
          id: neighborId,
          name: neighbor.label,
          group: (neighborsAndNodeIds[neighborId].name) ? neighborsAndNodeIds[neighborId].name : "",
          color: neighborsAndNodeIds[neighborId].color
        })
      }
    }
    neighbors.sort((node1, node2) => node1.group.toLowerCase().localeCompare(node2.group.toLowerCase())
        || node1.name.toLowerCase().localeCompare(node2.name.toLowerCase()));
    for (neighbor in neighbors) {
      neighborsHtmlList.push(`<li class="membership"><!--suppress JSUnresolvedFunction -->
        <a href="#${neighbor.name}" onclick="nodeActive('${neighbor.id}')"
        onmouseout="_sigma.refresh()">${neighbor.name}</a></li>`);
    }
    return neighborsHtmlList;
  };

  let neighborsHtml = neighborsHtml.concat(createList(_sigma.neighbors));

  node.hidden = false;
  node.attr.color = node.color;
  node.attr.lineWidth = 6;
  node.attr.strokeStyle = "#000000";

  //noinspection JSUnresolvedFunction
  _sigma.refresh();

  $GP.info_link.find("ul").html(neighborsHtml.join(""));

  if (node.attr.attributes) {
    let attributesHtml = [];
    for (let attr of node.attr.attributes) {
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
  _sigma.active = nodeId;
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
      edge.attr.lineWidth = false;
      edge.attr.color = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of _sigma.graph.nodes()) {
      node.hidden = true;
    }
    let clusterHiddenNodesHtmlList = [];
    let clusterHiddenNodesIds = [];
    for (let clusterNodeId of cluster) {
      let clusterNode = _sigma.graph.nodesIndex[clusterNodeId];
      if (clusterNode.hidden) {
        clusterHiddenNodesIds.push(clusterNodeId);
        clusterNode.hidden = false;
        clusterNode.attr.lineWidth = false;
        clusterNode.attr.color = clusterNode.color;
        clusterHiddenNodesHtmlList.push(`<li class="membership"><!--suppress JSUnresolvedFunction --><a href="#
          ${clusterNode.label}" onclick="nodeActive('${clusterNode.id}')" onmouseout="_sigma.refresh()">
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
