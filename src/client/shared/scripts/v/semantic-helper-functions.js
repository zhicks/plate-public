/* Helper functions for Semantic UI 
 */

(function() {
    function resize() {
        var $masthead = $('#masthead');
        var bgcolor = $masthead.css('background');
        var height = $masthead.outerHeight();
        var $backcolor = $('#backcolor');
        var $gradient = $('#gradient');
        var background = $masthead.css('background');
        $backcolor.height(height);
        $backcolor.css('background', background);
        $gradient.height(height);
        $masthead.css('background', 'transparent');
        $gradient.animate({ 'opacity': 1 }, 2000);
    }
    $(document).ready(function() {
        // fix menu when passed
        $('.masthead').visibility({
            once: false,
            onBottomPassed: function() {
                $('#main-menu').transition('fade out');
                $('.top.fixed.menu').transition('fade in');
            },
            onBottomPassedReverse: function() {
                $('.top.fixed.menu').transition('fade out');
                $('#main-menu').transition('fade in');
            }
        });
        resize();
    });

    $(window).resize(function() {
        resize();
    });
})();