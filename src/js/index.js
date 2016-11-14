(function($) {
  "use strict"; // Start of use strict

  // jQuery for page scrolling feature - requires jQuery Easing plugin
  $('a.page-scroll').bind('click', event => {
    var $anchor = $(this);
    $('html, body').stop().animate({
        scrollTop: ($($anchor.attr('href')).offset().top - 50)
    }, 1250, 'easeInOutExpo');
    event.preventDefault();
  });

  // Highlight the top nav as scrolling occurs
  $('body').scrollspy({
    target: '.navbar-fixed-top',
    offset: 51
  });

  // Closes the Responsive Menu on Menu Item Click
  $('.navbar-collapse ul li a').click(() => $('.navbar-toggle:visible').click());

  // Offset for Main Navigation
  $('#mainNav').affix({
    offset: {
        top: 100
    }
  });

  // Initialize and Configure Scroll Reveal Animation
  //noinspection JSUnresolvedFunction
  window.sr = ScrollReveal();
  //noinspection JSUnresolvedFunction
  sr.reveal('.sr-icons', {
    duration: 600,
    scale: 0.3,
    distance: '0px'
  }, 200);
  //noinspection JSUnresolvedFunction
  sr.reveal('.sr-button', {
    duration: 1000,
    delay: 200
  });
  //noinspection JSUnresolvedFunction
  sr.reveal('.sr-contact', {
    duration: 600,
    scale: 0.3,
    distance: '0px'
  }, 300);

  // Have to do it here because htmlmin has problems with quotes when using onclick="window.open('...')".
  $('#informe-1').click(() => window.open("/docs/informe_1_ingresos_y_gastos.pdf"));
  $('#informe-2').click(() => window.open("/docs/informe_2_financiamiento_privado.pdf"));
  $('#informe-3').click(() => window.open("/docs/informe_3_gasto_en_publicidad.pdf"));
})(jQuery); // End of use strict
