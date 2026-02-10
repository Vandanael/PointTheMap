(function () {
  try {
    var gpc = navigator && navigator.globalPrivacyControl === true;
    var dnt = (navigator && navigator.doNotTrack === '1') || (window && window.doNotTrack === '1');
    if (gpc || dnt) {
      window.plausible = function () {};
      window.plausible.q = [];
      window.plausible.init = function () {};
      return;
    }
  } catch (e) {}
  ((window.plausible =
    window.plausible ||
    function () {
      (plausible.q = plausible.q || []).push(arguments);
    }),
    (plausible.init =
      plausible.init ||
      function (i) {
        plausible.o = i || {};
      }));
  plausible.init();
})();
