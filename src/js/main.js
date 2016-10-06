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
    color: "#ff1a1a",
    count: 110,
    name: "Listas y candidatos a presidente",
  },
  1: {
    color: "#29d429",
    count: 290,
    name: "Candidatos a senador y diputado",
  },
  2: {
    color: "#2929d4",
    count: 594,
    name: "Empresas donantes",
  },
  3: {
    color: "#66f6ff",
    count: 338,
    name: "Individuos donantes",
  },
  4: {
    color: "#d4d429",
    count: 222,
    name: "Donaciones anónimas",
  },
  5: {
    color: "#ff1fce",
    count: 107,
    name: "Donaciones \"varias\"",
  },
};

$(document).ready(() => {
  setupElements();
  setupSigma();
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
  elements.cluster = new Cluster(elements.form.find("#attributeselect"));
}

function setupSigma() {
  $.getJSON('data.json', data => {
    //noinspection JSUnresolvedFunction
    for (let edge of data['edges']) {
      edge['color'] = '#ccc'; // TODO: should remove this
    }

    sigma = new Sigma({
      graph: data,
      renderers: [{
        container: 'sigma-canvas',
        type: 'canvas'
      }],
      settings: {
        defaultEdgeColor: '#ccc',
        defaultEdgeHoverColor: '#000',
        //defaultEdgeType: 'curve', // TODO: should add this
        defaultHoverLabelBGColor: "#002147",
        defaultLabelHoverColor: "#fff",
        doubleClickZoomDuration: 300,
        edgeColor: 'default',
        edgeHoverColor: 'default',
        edgeHoverExtremities: true,
        enableEdgeHovering: true,
        fontStyle: "bold",
        hoverFontStyle: "bold",
        minEdgeSize: 0.5,
        maxEdgeSize: 8,
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

    //noinspection JSUnresolvedFunction
    sigma.clusters = _.chain(sigma.graph.nodes())
      .groupBy(node => node.color)
      .mapObject(nodes => _.map(nodes, node => node.id))
      .value();

    //noinspection JSUnresolvedFunction
    sigma.bind("clickNode", event => showActiveMode(event.data.node));

    setupLegend();

    setupClusterSelection();

    setupZoomButtons();

    let hashAnchor = window.location.hash.substr(1);
    if (hashAnchor.length > 0) {
      elements.search.exactMatch = elements.search.search(hashAnchor);
      elements.search.clean();
    }
  });
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

function setupLegend() {
  //noinspection JSUnresolvedFunction
  _.chain(CLASSES)
    .forEach(_class => {
      $(`<div class="item-group">
           <!--suppress HtmlUnknownAnchorTarget -->
           <div class="item-group-color legend-item" style="background: ${_class.color}">
           </div>
           ${_class.name} (${_class.count})
         </div>`)
        .appendTo(elements.legend_box);
    });
}

function setupClusterSelection() {
  let clustersKeys = Object.keys(sigma.clusters);

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
          return `<div class="item-group">
                    <a href="#${clusterId}">
                      <div class="item-group-color" style="background: ${clusterId}">
                      </div>
                      Grupo ${clusterNumber} (${sigma.clusters[clusterId].length} miembros)
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
        if (!showCluster(text)) {
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
    this.list.find("a").click(() => showCluster($(event.currentTarget).attr("href").substr(1)));
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
    elements.cluster.hide();
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

  //noinspection JSUnresolvedFunction
  _.chain(sigma.neighbors[node.id])
    .sortBy(node => node.label)
    .each(node =>
      $(
        `<li class="membership">
          <a href="#${node.label}">${node.label}</a>
        </li>`
      )
        .click(() => showActiveMode(node))
        .appendTo(elements.info_link_ul)
    );

  elements.info_name.html(
    `<div>
      <span>${node.label}</span>
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
  elements.info.animate({ width: 'show' }, 350);
  elements.info_donnees.hide();
  elements.info_donnees.show();
  sigma.active = node.id;
  window.location.hash = node.label;
}

function showCluster(clusterName) {
  let cluster = sigma.clusters[clusterName];
  if (typeof cluster !== "undefined" && cluster.length > 0) {
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

    let clusterHiddenNodesIds = [];
    for (let clusterNodeId of cluster) {
      let clusterNode = sigma.nodesById[clusterNodeId];
      if (clusterNode.hidden) {
        clusterHiddenNodesIds.push(clusterNodeId);
        clusterNode.hidden = false;
        clusterNode.attributes.lineWidth = false;
        clusterNode.attributes.color = clusterNode.color;
        $(
          `<li class="membership"><!--suppress JSUnresolvedFunction -->
            <a href="#${clusterNode.label}">${clusterNode.label}</a>
          </li>`
        )
          .click(() => showActiveMode(clusterNode))
          .appendTo(elements.info_link_ul);
      }
    }
    sigma.clusters[clusterName] = clusterHiddenNodesIds;
    //noinspection JSUnresolvedFunction
    sigma.refresh();
    elements.info_name.html("<b>" + clusterName + "</b>");
    elements.info_data.hide();
    elements.info_p.html("Miembros del grupo:");
    elements.info.animate({ width: 'show' }, 350);
    elements.search.clean();
    elements.cluster.hide();
    return true;
  }
  return false;
}
