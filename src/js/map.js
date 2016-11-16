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
      this.state.addClass("searching");
      this.search(this.input.val(), false);
      return false;
    }
  });
  this.state.click(() => {
    let stateValue = this.input.val();
    if (this.searching && stateValue == this.lastSearch) {
      this.close();
    } else {
      this.state.addClass("searching");
      this.search(stateValue, false);
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
  this.search = (text, exactMatch) => {
    text = text.toLowerCase();
    this.searching = true;
    this.lastSearch = text;
    this.results.empty();
    if (text.length <= 2) {
      this.results.html("<i>El texto a buscar debe contener al menos 3 letras.</i>");
    } else {
      //noinspection JSUnresolvedFunction
      let foundNodes = _.chain(sigma.graph.nodes())
        .filter(node =>
          exactMatch
            ? node.label.toLowerCase() === text
            : node.label.toLowerCase().indexOf(text) !== -1
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
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};
