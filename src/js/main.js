'use strict';

import $ from "jquery";
import Sigma from "sigma-webpack";
import _ from "underscore";

// Using sigma-webpack version because GH dependency of sigma repo didn't work, and the last patch in master is needed
// in order to work with node. Otherwise, the container is not found.

let elements;
let sigma;
const CLASSES = {
  0: {
    color: "#f44336",
    name: "Listas y candidatos a presidente",
  },
  1: {
    color: "#4caf50",
    name: "Candidatos donantes",
  },
  2: {
    color: "#3f51b5",
    name: "Empresas donantes",
  },
  3: {
    color: "#03a9f4",
    name: "Individuos donantes",
  },
  4: {
    color: "#ffc107",
    name: "Donaciones anónimas",
  },
  5: {
    color: "#9c27b0",
    name: "Donaciones \"varias\"",
  },
};
const DEPARTMENTS = {
  0: "Artigas",
  1: "Canelones",
  2: "Cerro Largo",
  3: "Colonia",
  4: "Durazno",
  5: "Flores",
  6: "Florida",
  7: "Lavalleja",
  8: "Maldonado",
  9: "Montevideo",
  10: "Paysandú",
  11: "Río Negro",
  12: "Rivera",
  13: "Rocha",
  14: "Salto",
  15: "San José",
  16: "Soriano",
  17: "Tacuarembó",
  18: "Treinta y Tres",
  19: "Todo el país"
};
const LEVELS = {
  0: "Fórmula presidencial",
  1: "Candidato al senado",
  2: "Candidatos a diputados"
};
const PARTIES = {
  0: "Frente Amplio",
  1: "Partido Nacional",
  2: "Partido Colorado",
  3: "Partido Independiente",
  4: "Unidad Popular",
  5: "Partido de los Trabajadores",
  6: "Partido Ecologista Radical Intransigente",
};

const MIN_NODE_SIZE = 8;
const MAX_NODE_SIZE = 75;

$(document).ready(() => {
  setupElements();
  $.getJSON('data.json', data => {
    setupSigma(data);
    setupLegend();
    setupClassSelection();
    setupZoomButtons();
    checkHash();
  });
});

function setupElements() {
  elements = {
    calculating: false,
    form: $("#mainpanel").find("form"),
    info: $("#attributepane"),
    legend_box: $(".box"),
    modal: $('#moreInformationModal'),
  };
  elements.info_donnees = elements.info.find(".nodeattributes");
  elements.info_name = elements.info.find(".name");
  elements.info_link = elements.info.find(".link");
  elements.info_data = elements.info.find(".data");
  elements.info_p = elements.info.find(".p");
  elements.info_link_ul = elements.info_link.find("ul");
  elements.info_close = elements.info.find(".left-close")
      .click(showNormalMode);
  elements.search = new Search(elements.form.find("#search"));
  elements.class = new Class(elements.form.find("#attributeselect"));
}

function setupSigma(data) {
  for (let node of data.nodes) {
    let _class = CLASSES[node.class];
    node.color = _class.color;
  }

  setNodeSize(data);

  let nextEdgeId = 0;
  for (let edge of data.edges) {
    edge.id = nextEdgeId;
    nextEdgeId++;

    edge.color = '#ccc'; // TODO: should remove this
  }

  sigma = new Sigma({
    graph: data,
    renderers: [{
      container: 'sigma-canvas',
      type: 'canvas'
    }],
    settings: {
      defaultEdgeColor: '#ccc',
      defaultEdgeHoverColor: '#212121',
      //defaultEdgeType: 'curve', // TODO: should add this
      defaultHoverLabelBGColor: "#607D8B",
      //defaultLabelSize: 17,
      doubleClickZoomDuration: 300,
      edgeColor: 'default',
      edgeHoverColor: 'default',
      edgeHoverExtremities: true,
      enableEdgeHovering: true,
      fontStyle: "bold",
      hoverFontStyle: "bold",
      labelThreshold: 4,
      maxEdgeSize: MIN_NODE_SIZE,
      minEdgeSize: 0.5,
    }
  });

  sigma.active = false;
  sigma.detail = false;

  //noinspection JSUnresolvedFunction
  sigma.nodesById = _.chain(sigma.graph.nodes())
    .groupBy(node => node.id)
    .mapObject(nodes => nodes[0])
    .value();

  loadNeighbors();
  loadEdgesById();

  loadNodesByClass();

  //noinspection JSUnresolvedFunction
  sigma.bind("clickNode", event => showActiveMode(event.data.node));
}

function setNodeSize(data) {
  let amountPerNode = getAmountPerNode(data);

  //noinspection JSUnresolvedFunction
  let minAmount = _.min(amountPerNode, amount => amount);
  //noinspection JSUnresolvedFunction
  let maxAmount = _.max(amountPerNode, amount => amount);

  for (let node of data.nodes) {
    // The size is a linear interpolation wrt the min and max amount, and the min and max node size possible.
    node.size = ((maxAmount - minAmount) * amountPerNode[node.id]
      + (MIN_NODE_SIZE * maxAmount - MAX_NODE_SIZE * minAmount)) / (MAX_NODE_SIZE - MIN_NODE_SIZE);
  }
}

function getAmountPerNode(data) {
  //noinspection JSUnresolvedFunction
  let amountPerSource = _.chain(data.edges)
    .groupBy(edge => edge.source)
    .mapObject(edges => _.reduce(edges, (currentAmount, edge) => currentAmount + edge.size, 0))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(data.nodes)
    .map(node => node.id)
    .reject(id => id in amountPerSource)
    .each(id => amountPerSource[id] = 0);

  //noinspection JSUnresolvedFunction
  let amountPerTarget = _.chain(data.edges)
    .groupBy(edge => edge.target)
    .mapObject(edges => _.reduce(edges, (currentAmount, edge) => currentAmount + edge.size, 0))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(data.nodes)
    .map(node => node.id)
    .reject(id => id in amountPerTarget)
    .each(id => amountPerTarget[id] = 0);

  //noinspection JSUnresolvedFunction
  return _.mapObject(amountPerSource, (nodeAmount, id) => nodeAmount + amountPerTarget[id]);
}



function loadNeighbors() {
  let adjacencies = getAdjacencies();
  let incidents = getIncidents();

  //noinspection JSUnresolvedFunction
  sigma.neighbors = _.mapObject(adjacencies, (nodes, id) => nodes.concat(incidents[id]));
}

function getAdjacencies() {
  //noinspection JSUnresolvedFunction
  let adjacencies = _.chain(sigma.graph.edges())
    .groupBy(edge => edge.source)
    .mapObject(edges => _.map(edges, edge => sigma.nodesById[edge.target]))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in adjacencies)
    .each(id => adjacencies[id] = []);

  return adjacencies;
}

function getIncidents() {
  //noinspection JSUnresolvedFunction
  let incidents = _.chain(sigma.graph.edges())
    .groupBy(edge => edge.target)
    .mapObject(edges => _.map(edges, edge => sigma.nodesById[edge.source]))
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in incidents)
    .each(id => incidents[id] = []);

  return incidents;
}




function loadEdgesById() {
  let adjacentEdges = getAdjacentEdges();
  let incidentEdges = getIncidentEdges();

  //noinspection JSUnresolvedFunction
  sigma.edgesById = _.chain(adjacentEdges)
    .mapObject((nodes, id) => nodes.concat(incidentEdges[id]))
    .mapObject(nodes => _.sortBy(nodes, 'size').reverse())
    .value();
}

function getAdjacentEdges() {
  //noinspection JSUnresolvedFunction
  let adjacentEdges = _.chain(sigma.graph.edges())
    .groupBy(edge => edge.source)
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in adjacentEdges)
    .each(id => adjacentEdges[id] = []);

  return adjacentEdges;
}

function getIncidentEdges() {
  //noinspection JSUnresolvedFunction
  let incidentEdges = _.chain(sigma.graph.edges())
    .groupBy(edge => edge.target)
    .value();

  //noinspection JSUnresolvedFunction
  _.chain(sigma.graph.nodes())
    .map(node => node.id)
    .reject(id => id in incidentEdges)
    .each(id => incidentEdges[id] = []);

  return incidentEdges;
}



function loadNodesByClass() {
  //noinspection JSUnresolvedFunction
  let nodesByClass = _.chain(sigma.graph.nodes())
    .groupBy(node => node.class)
    .mapObject(nodes => _.map(nodes, node => node.id))
    .value();

  //noinspection JSUnresolvedFunction
  for (let classId of _.keys(CLASSES)) {
    let _class = CLASSES[classId];
    _class.nodes = nodesByClass[classId];
  }
}

function setupLegend() {
  //noinspection JSUnresolvedFunction
  _.chain(_.values(CLASSES))
    .forEach(_class => {
      $(
        `<div class="item-group">
          <div class="item-group-color legend-item" style="background: ${_class.color}">
          </div>
          ${_class.name} (${_class.nodes.length})
        </div>`
      )
        .appendTo(elements.legend_box);
    });
}

function setupClassSelection() {
  //noinspection JSUnresolvedFunction
  elements.class.content(
    _.chain(_.keys(CLASSES))
      .map(classId => {
        let _class = CLASSES[classId];
        return `<div class="item-group">
                  <a href="#${classId}">
                    <div class="item-group-color" style="background: ${_class.color}">
                    </div>
                    ${_class.name} (${_class.nodes.length})
                  </a>
                </div>`;
        }
      )
      .reduce((accumulator, html) => `${accumulator}${html}`)
      .value()
  );
}

function setupZoomButtons() {
  $("#zoom").find("div.z").each((i, element) => {
    let $element = $(element);
    let rel = $element.attr("rel");
    $element.click(() => {
      if (rel == "center") {
        //noinspection JSUnresolvedFunction
        sigma.cameras[0].goTo({ratio: 1, x: 0, y: 0});
      } else {
        //noinspection JSUnresolvedFunction
        Sigma.utils.zoomTo(sigma.cameras[0], 0, 0, rel == "in" ? 0.5 : 1.5, {
          duration: sigma.settings('doubleClickZoomDuration'),
        });
      }
    });
  });
}

function checkHash() {
  let hashAnchor = window.location.hash.substr(1);
  if (hashAnchor.length > 0) {
    elements.search.exactMatch = elements.search.search(hashAnchor);
    elements.search.clean();
  }
}

function Search(searchElem) {
  this.input = searchElem.find("input[name=search]");
  this.state = searchElem.find(".state");
  this.results = searchElem.find(".results");
  this.lastSearch = "";
  this.searching = false;
  this.input.keydown(event => {
    if (event.which == 13) {
      this.state.addClass("searching");
      this.search(this.input.val());
      return false;
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
    let textRegex = new RegExp(text.toLowerCase());
    this.searching = true;
    this.lastSearch = text;
    this.results.empty();
    if (text.length <= 2) {
      this.results.html("<i>El texto a buscar debe contener al menos 3 letras.</i>");
    } else {
      //noinspection JSUnresolvedFunction
      let foundNodes = _.chain(sigma.graph.nodes())
        .filter(node => textRegex.test(node.label.toLowerCase()))
        .value();

      if (foundNodes.length == 0) {
        if (!showClass(text)) {
          this.results.html("<i>No se encontró ningún resultado.</i>");
        }
      } else {
        if (foundNodes.length == 1) {
          showActiveMode(foundNodes[0]);
        }
        this.results.html("<b>Resultados encontrados: </b>");
        for (let foundNode of foundNodes) {
          $(`<a href="#${foundNode.label}">${foundNode.label}</a>`)
            .click(() => showActiveMode(foundNode))
            .appendTo(this.results);
        }
      }
    }
    this.results.show();
  }
}

function Class(classElem) {
  this.class = classElem;
  this.display = false;
  this.list = this.class.find(".list");
  this.list.empty();
  this.select = this.class.find(".select");
  this.select.click(() => elements.class.toggle());
  this.toggle = () => this.display ? this.hide() : this.show();
  this.content = html => {
    this.list.html(html);
    this.list.find("a").click(() => showClass($(event.currentTarget).attr("href").substr(1)));
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
  if (!elements.calculating && sigma.detail) {
    elements.calculating = true;
    sigma.detail = true;
    //noinspection JSUnresolvedFunction
    elements.info.delay(400).animate({width: 'hide'}, 350);
    elements.class.hide();
    //noinspection JSUnresolvedFunction
    for (let edge of sigma.graph.edges()) {
      edge.hidden = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of sigma.graph.nodes()) {
      node.hidden = false;
    }
    //noinspection JSUnresolvedFunction
    sigma.refresh();
    sigma.active = false;
    elements.calculating = false;
    window.location.hash = "";
  }
}

function showActiveMode(node) {
  sigma.detail = true;

  //noinspection JSUnresolvedFunction
  for (let node1 of sigma.graph.nodes()) {
    node1.hidden = true;
  }

  node.hidden = false;

  for (let neighbor of sigma.neighbors[node.id]) {
    neighbor.hidden = false;
  }

  //noinspection JSUnresolvedFunction
  sigma.refresh();

  elements.info_link_ul.empty();

  let totalDonations = 0;

  let byOrToWord = node.class == 0 ? "por" : "a";

  //noinspection JSUnresolvedFunction
  _.chain(sigma.edgesById[node.id])
    .each(edge => {
      totalDonations += edge.size;

      let neighborId = node.id == edge.source ? edge.target : edge.source;
      let neighbor = sigma.nodesById[neighborId];

      $(
        `<li class="membership">
          ${formatAsCurrency(edge.size)} ${byOrToWord} <a href="#${neighbor.label}">${neighbor.label}</a>
        </li>`
      )
        .click(() => showActiveMode(neighbor))
        .appendTo(elements.info_link_ul);
    });

  elements.info_name.html(`<h3>${node.label}</h3>`);

  elements.info_data.html(getFormattedDataForNode(node));
  elements.info_data.show();

  let receivedOrEmittedWord = node.class == 0 ? "recibidas" : "emitidas";

  elements.info_p.html(`${formatAsCurrency(totalDonations)} en donaciones ${receivedOrEmittedWord}`);
  elements.info.animate({ width: 'show' }, 350);
  elements.info_donnees.hide();
  elements.info_donnees.show();
  sigma.active = node.id;
  window.location.hash = node.label;
}

function showClass(classId) {
  let _class = CLASSES[classId];
  if (typeof _class !== "undefined" && _class.nodes.length > 0) {
    sigma.detail = true;

    //noinspection JSUnresolvedFunction
    for (let edge of sigma.graph.edges()) {
      edge.hidden = false;
      edge.attributes.lineWidth = false;
      //edge.attributes.color = false;
    }
    //noinspection JSUnresolvedFunction
    for (let node of sigma.graph.nodes()) {
      node.hidden = true;
    }

    elements.info_link_ul.empty();

    let classHiddenNodesIds = [];
    for (let classNodeId of _class.nodes) {
      let classNode = sigma.nodesById[classNodeId];
      if (classNode.hidden) {
        classHiddenNodesIds.push(classNodeId);
        classNode.hidden = false;
        classNode.attributes.lineWidth = false;
        classNode.attributes.color = classNode.color;
        $(
          `<li class="membership"><!--suppress JSUnresolvedFunction -->
            <a href="#${classNode.label}">${classNode.label}</a>
          </li>`
        )
          .click(() => showActiveMode(classNode))
          .appendTo(elements.info_link_ul);
      }
    }
    CLASSES[classId].nodes = classHiddenNodesIds;
    //noinspection JSUnresolvedFunction
    sigma.refresh();
    elements.info_name.html("<b>" + classId + "</b>");
    elements.info_data.hide();
    elements.info_p.html("Miembros del grupo:");
    elements.info.animate({ width: 'show' }, 350);
    elements.search.clean();
    elements.clas.hide();
    return true;
  }
  return false;
}

function getFormattedDataForNode(node) {
  switch (node.class) {
    case 0:
      let attrs = node.attributes;
      return `<strong>${PARTIES[attrs.party]}</strong>
              <br />
              <strong>${LEVELS[attrs.level]}</strong>
              ${attrs.department == 19
                  ? "" : `<br /><strong>${DEPARTMENTS[attrs.department]}</strong>`}
              ${attrs.level == 2
                  ? `<br /><strong>Primer titular</strong>: ${attrs.first_holder}` : ""}
              <br />
              ${addSpanishThousandsSeparator(attrs.votes)} votos recibidos
              <br />
              ${typeof attrs.seats !== "undefined" ? `${attrs.seats} bancas` : ""}
      `;
    case 1:
      return "Candidato";
    case 2:
      return "Empresa";
    case 3:
      return "Individuo";
    case 4:
      return "Donación anónima";
    default:
      return "";
  }
}

function formatAsCurrency(number) {
  return `$ ${addSpanishThousandsSeparator(number)}`;
}

function addSpanishThousandsSeparator(nStr) {
  nStr += '';
  let x = nStr.split(',');
  let x1 = x[0];
  let x2 = x.length > 1 ? ',' + x[1] : '';
  let rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + '.' + '$2');
  }
  return x1 + x2;
}
