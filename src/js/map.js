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

const OPACITY_INACTIVE_NODE = 0.2;

const COLOR_ACTIVE_EDGE = '#ccc';
const COLOR_INACTIVE_EDGE = `rgba(204, 204, 204, ${OPACITY_INACTIVE_NODE})`;

const COLOR_ACTIVE_LABEL = '#424242';
const COLOR_INACTIVE_LABEL = `rgba(67, 67, 67, ${OPACITY_INACTIVE_NODE})`;

$(document).ready(() => {
  setupElements();
  setupZoomButtons();
  $.getJSON('data.json', data => {
    setupSigma(data);
    setupLegend();
    setupClassSelection();
    checkHash();
  });
});

function setupElements() {
  elements = {
    calculating: false,
    info: $("#attributepane"),
    legend_box: $(".box"),
    main_panel: $("#mainpanel"),
    menu: $('#menu'),
    modal: $('#moreInformationModal'),
    zoom: $('#zoom'),
  };
  elements.form = elements.main_panel.find("form");
  elements.info_donnees = elements.info.find(".nodeattributes");
  elements.info_name = elements.info.find(".name");
  elements.info_link = elements.info.find(".link");
  elements.info_data = elements.info.find(".data");
  elements.info_share_data = elements.info.find(".share_data");
  elements.info_p = elements.info.find(".p");
  elements.info_link_ul = elements.info_link.find("ul");
  elements.info_close = elements.info.find(".left-close")
      .click(showNormalMode);
  elements.search = new Search(elements.form.find("#search"));
  elements.class = new Class(elements.form.find("#attributeselect"));

  $(document).keydown(event => {
    if (event.keyCode == 27) { // ESCAPE key pressed
      if (sigma.active) {
        showNormalMode();
      }
    }
  });
}

function setupSigma(data) {
  for (let node of data.nodes) {
    let _class = CLASSES[node.class];
    node.color = _class.color;

    node.labelColor = COLOR_ACTIVE_LABEL;
  }

  setNodeSize(data);

  let nextEdgeId = 0;
  for (let edge of data.edges) {
    edge.id = nextEdgeId;
    nextEdgeId++;
  }

  sigma = new Sigma({
    graph: data,
    renderers: [{
      container: 'sigma-canvas',
      type: 'canvas'
    }],
    settings: {
      defaultEdgeColor: COLOR_ACTIVE_EDGE,
      defaultEdgeHoverColor: '#212121',
      defaultHoverLabelBGColor: "#607D8B",
      //defaultLabelSize: 17, // For taking a screenshot.
      doubleClickZoomDuration: 300,
      edgeColor: 'default',
      edgeHoverColor: 'default',
      edgeHoverExtremities: true,
      enableEdgeHovering: true,
      fontStyle: "bold",
      hoverFontStyle: "bold",
      labelColor: 'node',
      labelThreshold: 7,
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
  //noinspection JSUnresolvedFunction
  sigma.bind("clickStage", event => {
    if (!event.data.captor.isDragging) {
      showNormalMode();
    }
  });
}

function setNodeSize(data) {
  let amountPerNode = getAmountPerNode(data);

  //noinspection JSUnresolvedFunction
  let minAmount = _.min(amountPerNode, amount => amount);
  //noinspection JSUnresolvedFunction
  let maxAmount = _.max(amountPerNode, amount => amount);

  for (let node of data.nodes) {
    // The size is a linear interpolation wrt the min and max amount, and the min and max node size possible.
    node.size = ((MAX_NODE_SIZE - MIN_NODE_SIZE) * amountPerNode[node.id]
      + (MIN_NODE_SIZE * maxAmount - MAX_NODE_SIZE * minAmount)) / (maxAmount - minAmount);
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
  sigma.edgesByNodeId = _.chain(adjacentEdges)
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
  if (window.mobilecheck()) {
    elements.main_panel.hide(0);
    elements.menu.show(0);
    elements.zoom.css("left", "20%");
    elements.menu.click(() => elements.main_panel.fadeToggle());
  }

  elements.zoom.find("div.z").each((i, element) => {
    let $element = $(element);
    let rel = $element.attr("rel");
    if (rel != null) {
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
    }
  });
}

function checkHash() {
  let hashAnchor = decodeURIComponent(window.location.hash.substr(1));
  if (hashAnchor.length > 0) {
    elements.search.search(hashAnchor, true);
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
      this.search(this.input.val(), false);
      return false;
    }
  });
  this.state.click(() => {
    let stateValue = this.input.val();
    if (this.searching && stateValue == this.lastSearch) {
      this.close();
    } else {
      this.search(stateValue, false);
    }
  });
  this.close = () => {
    this.clean();
    showNormalMode();
  };
  this.clean = () => {
    this.searching = false;
    this.results.empty().hide();
    this.state.removeClass("searching");
    this.input.val("");
  };
  this.search = (text, exactMatch) => {
    if ($.trim(text)) {
      this.state.addClass("searching");
      text = removeDiacritics(text.toLowerCase());
      this.searching = true;
      this.lastSearch = text;
      this.results.empty();
      //noinspection JSUnresolvedFunction
      let foundNodes = _.chain(sigma.graph.nodes())
        .filter(node =>
          exactMatch
            ? removeDiacritics(node.label.toLowerCase()) === text
            : removeDiacritics(node.label.toLowerCase()).indexOf(text) !== -1
        )
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
      this.results.show();
    }
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
    elements.info.delay(200).animate({width: 'hide'}, 350);
    if (window.mobilecheck()) {
      elements.zoom.show();
    }
    elements.class.hide();
    //noinspection JSUnresolvedFunction
    for (let edge of sigma.graph.edges()) {
      edge.color = COLOR_ACTIVE_EDGE;
    }
    //noinspection JSUnresolvedFunction
    for (let node of sigma.graph.nodes()) {
      node.opacity = 1;
      node.labelColor = COLOR_ACTIVE_LABEL;
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
    node1.opacity = OPACITY_INACTIVE_NODE;
    node1.labelColor = COLOR_INACTIVE_LABEL;
  }

  //noinspection JSUnresolvedFunction
  for (let edge of sigma.graph.edges()) {
    edge.color = COLOR_INACTIVE_EDGE;
  }

  node.opacity = 1;
  node.labelColor = COLOR_ACTIVE_LABEL;

  for (let neighbor of sigma.neighbors[node.id]) {
    neighbor.opacity = 1;
    neighbor.labelColor = COLOR_ACTIVE_LABEL;
  }

  for (let edge of sigma.edgesByNodeId[node.id]) {
    edge.color = COLOR_ACTIVE_EDGE;
  }

  //noinspection JSUnresolvedFunction
  sigma.refresh();

  elements.info_link_ul.empty();

  let totalDonations = 0;

  let byOrToWord = node.class == 0 ? "de" : "a";

  //noinspection JSUnresolvedFunction
  _.chain(sigma.edgesByNodeId[node.id])
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

  window.location.hash = encodeURIComponent(node.label);

  let sharedTitle = `${node.label} | ¿De dónde sale el dinero de las campañas políticas?`;
  let sharedUrl = window.location;
  let sharedEncodedUrl = encodeURIComponent(sharedUrl);

  elements.info_share_data.html(
    `<div class="fb-share-button" data-href="${sharedUrl}" data-layout="button_count" data-size="small" data-mobile-iframe="true"><a class="fb-xfbml-parse-ignore" target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=${sharedEncodedUrl}&amp;src=sdkpreparse">Compartir</a></div>
     <a class="twitter-share-button" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(sharedTitle)}&via=ucudal&url=${sharedEncodedUrl}" data-size="small">Twittear</a>
     <a href="whatsapp://send" data-text="${sharedTitle}" data-href="" class="wa_btn wa_btn_s" style="display:none">Compartir</a>`
  );

  let receivedOrEmittedWord = node.class == 0 ? "recibidas" : "emitidas";

  elements.info_p.html(`${formatAsCurrency(totalDonations)} en donaciones ${receivedOrEmittedWord}`);
  elements.info.animate({ width: 'show' }, { duration: 350, complete: () => {
    FB.XFBML.parse();
    twttr.widgets.load();
    if (window.mobilecheck()) {
      //noinspection JSUnresolvedFunction
      WASHAREBTN.crBtn();
    }
  }});
  sigma.active = node.id;

  if (window.mobilecheck()) {
    elements.zoom.hide();
    elements.main_panel.hide();
  }
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
    elements.info_p.html("Miembros del grupo:");
    elements.info.animate({ width: 'show' }, 350);
    elements.search.clean();
    elements.class.hide();
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
              ${addSpanishThousandsSeparator(attrs.votes)} votos
              <br />
              ${typeof attrs.seats !== "undefined" ? `${attrs.seats} ${getSeatWordQuantified(attrs.seats)}` : ""}
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

function getSeatWordQuantified(seats) {
  return seats == 1 ? "banca" : "bancas";
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

window.mobilecheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

// To remove accents:
// http://stackoverflow.com/a/18391901/1165181
/*
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
const defaultDiacriticsRemovalMap = [
  {
    'base': 'A',
    'letters': '\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F'
  },
  {'base': 'AA', 'letters': '\uA732'},
  {'base': 'AE', 'letters': '\u00C6\u01FC\u01E2'},
  {'base': 'AO', 'letters': '\uA734'},
  {'base': 'AU', 'letters': '\uA736'},
  {'base': 'AV', 'letters': '\uA738\uA73A'},
  {'base': 'AY', 'letters': '\uA73C'},
  {'base': 'B', 'letters': '\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181'},
  {'base': 'C', 'letters': '\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E'},
  {
    'base': 'D',
    'letters': '\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\u00D0'
  },
  {'base': 'DZ', 'letters': '\u01F1\u01C4'},
  {'base': 'Dz', 'letters': '\u01F2\u01C5'},
  {
    'base': 'E',
    'letters': '\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E'
  },
  {'base': 'F', 'letters': '\u0046\u24BB\uFF26\u1E1E\u0191\uA77B'},
  {
    'base': 'G',
    'letters': '\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E'
  },
  {'base': 'H', 'letters': '\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D'},
  {
    'base': 'I',
    'letters': '\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197'
  },
  {'base': 'J', 'letters': '\u004A\u24BF\uFF2A\u0134\u0248'},
  {'base': 'K', 'letters': '\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2'},
  {
    'base': 'L',
    'letters': '\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780'
  },
  {'base': 'LJ', 'letters': '\u01C7'},
  {'base': 'Lj', 'letters': '\u01C8'},
  {'base': 'M', 'letters': '\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C'},
  {
    'base': 'N',
    'letters': '\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4'
  },
  {'base': 'NJ', 'letters': '\u01CA'},
  {'base': 'Nj', 'letters': '\u01CB'},
  {
    'base': 'O',
    'letters': '\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C'
  },
  {'base': 'OI', 'letters': '\u01A2'},
  {'base': 'OO', 'letters': '\uA74E'},
  {'base': 'OU', 'letters': '\u0222'},
  {'base': 'OE', 'letters': '\u008C\u0152'},
  {'base': 'oe', 'letters': '\u009C\u0153'},
  {'base': 'P', 'letters': '\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754'},
  {'base': 'Q', 'letters': '\u0051\u24C6\uFF31\uA756\uA758\u024A'},
  {
    'base': 'R',
    'letters': '\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782'
  },
  {
    'base': 'S',
    'letters': '\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784'
  },
  {
    'base': 'T',
    'letters': '\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786'
  },
  {'base': 'TZ', 'letters': '\uA728'},
  {
    'base': 'U',
    'letters': '\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244'
  },
  {'base': 'V', 'letters': '\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245'},
  {'base': 'VY', 'letters': '\uA760'},
  {'base': 'W', 'letters': '\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72'},
  {'base': 'X', 'letters': '\u0058\u24CD\uFF38\u1E8A\u1E8C'},
  {
    'base': 'Y',
    'letters': '\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE'
  },
  {'base': 'Z', 'letters': '\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762'},
  {
    'base': 'a',
    'letters': '\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250'
  },
  {'base': 'aa', 'letters': '\uA733'},
  {'base': 'ae', 'letters': '\u00E6\u01FD\u01E3'},
  {'base': 'ao', 'letters': '\uA735'},
  {'base': 'au', 'letters': '\uA737'},
  {'base': 'av', 'letters': '\uA739\uA73B'},
  {'base': 'ay', 'letters': '\uA73D'},
  {'base': 'b', 'letters': '\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253'},
  {'base': 'c', 'letters': '\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184'},
  {'base': 'd', 'letters': '\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A'},
  {'base': 'dz', 'letters': '\u01F3\u01C6'},
  {
    'base': 'e',
    'letters': '\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD'
  },
  {'base': 'f', 'letters': '\u0066\u24D5\uFF46\u1E1F\u0192\uA77C'},
  {
    'base': 'g',
    'letters': '\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F'
  },
  {
    'base': 'h',
    'letters': '\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265'
  },
  {'base': 'hv', 'letters': '\u0195'},
  {
    'base': 'i',
    'letters': '\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131'
  },
  {'base': 'j', 'letters': '\u006A\u24D9\uFF4A\u0135\u01F0\u0249'},
  {'base': 'k', 'letters': '\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3'},
  {
    'base': 'l',
    'letters': '\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747'
  },
  {'base': 'lj', 'letters': '\u01C9'},
  {'base': 'm', 'letters': '\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F'},
  {
    'base': 'n',
    'letters': '\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5'
  },
  {'base': 'nj', 'letters': '\u01CC'},
  {
    'base': 'o',
    'letters': '\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275'
  },
  {'base': 'oi', 'letters': '\u01A3'},
  {'base': 'ou', 'letters': '\u0223'},
  {'base': 'oo', 'letters': '\uA74F'},
  {'base': 'p', 'letters': '\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755'},
  {'base': 'q', 'letters': '\u0071\u24E0\uFF51\u024B\uA757\uA759'},
  {
    'base': 'r',
    'letters': '\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783'
  },
  {
    'base': 's',
    'letters': '\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B'
  },
  {
    'base': 't',
    'letters': '\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787'
  },
  {'base': 'tz', 'letters': '\uA729'},
  {
    'base': 'u',
    'letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289'
  },
  {'base': 'v', 'letters': '\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C'},
  {'base': 'vy', 'letters': '\uA761'},
  {'base': 'w', 'letters': '\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73'},
  {'base': 'x', 'letters': '\u0078\u24E7\uFF58\u1E8B\u1E8D'},
  {
    'base': 'y',
    'letters': '\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF'
  },
  {'base': 'z', 'letters': '\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763'}
];

const diacriticsMap = {};
for (let i = 0; i < defaultDiacriticsRemovalMap.length; i++) {
  const letters = defaultDiacriticsRemovalMap[i].letters;
  for (let j = 0; j < letters.length; j++){
    diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap[i].base;
  }
}

// "what?" version ... http://jsperf.com/diacritics/12
function removeDiacritics(str) {
  return str.replace(/[^\u0000-\u007E]/g, a => diacriticsMap[a] || a);
}
