define(['./gui'], function(ui) {
    function initKeyBindings() {
        Mousetrap.bind(['j', 'down'], function(x) { ui.moveSelLine("down"); });
        Mousetrap.bind(['k', 'up'], function(x) { ui.moveSelLine("up"); });
        Mousetrap.bind(['home'], function(x) { ui.moveSelLine("home"); });
        Mousetrap.bind(['end'], function(x) { ui.moveSelLine("end"); });
        Mousetrap.bind(['enter'], function(x) { ui.selectCurrentLine(); });
        Mousetrap.bind(['H'], function(x) { ui.showBranches(); });
        Mousetrap.bind(['l'], function(x) { ui.showCommits(); });
        Mousetrap.bind(['t'], function(x) { ui.showTreeForCommit(); });
        Mousetrap.bind(['A'], function(x) { ui.showRemoteRefs(); });
        Mousetrap.bind(['mod+k'], function(x) { ui.checkOutCurrentlySelected(); });
        Mousetrap.bind(['mod+b'], function(x) { ui.askToCreateNewBranch(); });
        Mousetrap.bind(['mod+l'], ui.askForRemote );
        Mousetrap.bind(['mod+o'], ui.chooseFSForLocalRepo );
        Mousetrap.bind(['mod+i'], ui.showDircache );
        Mousetrap.bind(['mod+shift+t'], function(x) { chrome.app.window.create("tests/tests.html", { id: "gitcrx-tests" }, null)} );
        Mousetrap.bind(['q'], ui.cancelCurrentContext );
    }
    return  {
        init: initKeyBindings
    };
})

