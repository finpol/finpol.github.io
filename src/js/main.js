'use strict';

import fb from "fancybox";
import $ from "jquery";
import sigma from "sigma-webpack";
import _ from "underscore";

// Using sigma-webpack version because GH dependency of sigma repo didn't work, and the last patch in master is needed
// in order to work with node. Otherwise, the container is not found.

fb($);

let _sigma;
let elements;

$(document).ready(() => {
  elements = {
    calculating: false,
  };
  elements.info = $("#attributepane");
  elements.info_donnees = elements.info.find(".nodeattributes");
  elements.info_name = elements.info.find(".name");
  elements.info_link = elements.info.find(".link");
  elements.info_data = elements.info.find(".data");
  elements.info_close = elements.info.find(".returntext");
  elements.info_close2 = elements.info.find(".close");
  elements.info_p = elements.info.find(".p");
  elements.info_close.click(showNormalMode);
  elements.info_close2.click(showNormalMode);
  elements.form = $("#mainpanel").find("form");
  elements.search = new Search(elements.form.find("#search"));
  elements.cluster = new Cluster(elements.form.find("#attributeselect"));

  initSigma();
});

function initSigma() {
  $.getJSON('data.json', data => {
    //noinspection JSPotentiallyInvalidConstructorUsage
    _sigma = new sigma({
      container: 'sigma-canvas',
      graph: data,
      settings: {
        defaultEdgeHoverColor: '#000',
        defaultHoverLabelBGColor: "#002147",
        defaultLabelHoverColor: "#fff",
        doubleClickZoomDuration: 300,
        edgeHoverExtremities: true,
        enableEdgeHovering: true,
        fontStyle: "bold",
        hoverFontStyle: "bold",
        labelThreshold: 10
      }
    });

    _sigma.active = false;
    _sigma.detail = false;

    //noinspection JSUnresolvedFunction
    _sigma.nodesById = _.chain(_sigma.graph.nodes())
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
  });
}

function loadNeighbors() {
  let adjacencies = getAdjacencies();
  let incidents = getIncidents();

  //noinspection JSUnresolvedFunction
  _sigma.neighbors = _.mapObject(adjacencies, (nodes, id) => nodes.concat(incidents[id]));
}

function getAdjacencies() {
  //noinspection JSUnresolvedFunction
  let adjacencies = _.chain(_sigma.graph.edges())
    .groupBy(edge => edge.source)
    .mapObject(edges => _.map(edges, edge => _sigma.nodesById[edge.target]))
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
    .mapObject(edges => _.map(edges, edge => _sigma.nodesById[edge.source]))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(_sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in incidents)
    .each(id => incidents[id] = []);

  return incidents;
}

function configSigmaElements() {
  let clustersKeys = Object.keys(_sigma.clusters);

  //noinspection JSUnresolvedFunction
  elements.cluster.content(
    _.chain(
        _.zip(
          _.range(1, clustersKeys.length + 1),
          clustersKeys
        )
      )
      .map(pair => {
          let clusterNumber = pair[0];
          let clusterId = pair[1];
          return `<div style="line-height:12px"><a href="#${clusterId}"><div style="width:40px;height:12px;
            border:1px solid #fff;background:${clusterId};display:inline-block"></div>
            Grupo ${clusterNumber} (${_sigma.clusters[clusterId].length} miembros)</a></div>`;
        }
      )
      .reduce((accumulator, html) => `${accumulator}${html}`)
      .value()
  );

  //noinspection JSUnresolvedFunction
  $("a.fb").fancybox({
    minWidth: 400,
    maxWidth: 800,
    maxHeight: 600,
  });

  $("#zoom").find("div.z").each((_, element) => {
    let $element = $(element);
    let rel = $element.attr("rel");
    $element.click(() => {
      if (rel == "center") {
        //noinspection JSUnresolvedFunction
        _sigma.cameras[0].goTo({ ratio: 1, x: 0, y: 0 });
      } else {
        //noinspection JSUnresolvedFunction
        sigma.utils.zoomTo(_sigma.cameras[0], 0, 0, rel == "in" ? 0.5 : 1.5, {
          duration: _sigma.settings('doubleClickZoomDuration'),
        });
      }
    });
  });

  let hashAnchor = window.location.hash.substr(1);
  if (hashAnchor.length > 0) {
    switch (hashAnchor) {
      case "information":
        $.fancybox.open($("#information"), "Esta visualización muestra las donaciones recibidas declaradas por los"
          + " partidos políticos para cada una de las listas políticas en las Elecciones Nacionales uruguayas del año"
          + " 2014. El tamaño de los nodos es proporcional al dinero recibido.\n\nLos puntos rojos representan listas a"
          + " la presidencia, los verdes candidatos a diputado y los amarillos a senador. Por otro lado, las empresas"
          + " donantes están en azul y los particulares en color celeste.");
        break;
      default:
        elements.search.exactMatch = elements.search.search(hashAnchor);
        elements.search.clean();
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
        showActiveMode(foundNodes[0]);
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
  this.select.click(() => elements.cluster.toggle());
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
  if (!elements.calculating && _sigma.detail) {
    elements.calculating = true;
    _sigma.detail = true;
    //noinspection JSUnresolvedFunction
    elements.info.delay(400).animate({width: 'hide'}, 350);
    elements.cluster.hide();
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
    _sigma.active = false;
    elements.calculating = false;
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
  for (let node1 of _sigma.graph.nodes()) {
    node1.hidden = true;
    node1.attributes.lineWidth = false;
    node1.attributes.color = node1.color;
  }

  node.hidden = false;
  node.attributes.color = node.color;
  node.attributes.lineWidth = 6;
  node.attributes.strokeStyle = "#000000";

  for (let neighbor of _sigma.neighbors[node.id]) {
    neighbor.hidden = false;
    neighbor.attributes.lineWidth = false;
  }

  //noinspection JSUnresolvedFunction
  _sigma.refresh();

  //noinspection JSUnresolvedFunction
  elements.info_link.find("ul").html(
    _.chain(_sigma.neighbors[node.id])
      .sortBy(node => node.label)
      .map(node =>
        `<li class="membership"><!--suppress JSUnresolvedFunction -->
          <a href="#${node.label}" onclick="showActiveMode('${node.id}')" onmouseout="refresh()">${node.label}</a>
        </li>`
      )
      .reduce((accumulator, html) => `${accumulator}${html}`)
      .value()
  );

  elements.info_name.html(
    `<div><!--suppress JSUnresolvedFunction -->
      <span onmouseout="refresh()">${node.label}</span>
    </div>`
  );

  //noinspection JSUnresolvedFunction
  elements.info_data.html(
    _.chain(node.attributes)
      .reject(attr => attr == false)
      .map(attr => `<span><strong>${attr}:</strong>${attr}</span>`)
      .reduce((accumulator, html) => `${accumulator}<br />${html}`)
      .value()
  );

  elements.info_data.show();
  elements.info_p.html("Conexiones:");
  elements.info.animate({width: 'show'}, 350);
  elements.info_donnees.hide();
  elements.info_donnees.show();
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
      let clusterNode = _sigma.nodesById[clusterNodeId];
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
    elements.info_name.html("<b>" + clusterName + "</b>");
    elements.info_data.hide();
    elements.info_p.html("Miembros del grupo:");
    elements.info_link.find("ul").html(clusterHiddenNodesHtmlList.join(""));
    elements.info.animate({width: 'show'}, 350);
    elements.search.clean();
    elements.cluster.hide();
    return true;
  }
  return false;
}

function refresh() {
  //noinspection JSUnresolvedFunction
  _sigma.refresh();
}
