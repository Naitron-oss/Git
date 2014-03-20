define(['./git-cmds', 'js/paged-table', './git-data-helper'], function(git, PagedTable, gitDataHelper) {

    //setup Codemirror
    var cmConfig = {
      mode: "text/x-diff",
      theme: "midnight",
      readOnly: true,
      styleActiveLine: true,
      //Tab disabled to allow normal browser tabbing to occur b/w CM and commit list 
      extraKeys: { Tab: false }
    };
    
    var currentListTable, commitListTable, branchListTable, treeviewTable; //always start with commit list view
    var myCodeMirror;
    var NUM_COMMIT_LINES = 10;
    var MAX_COMMIT_HIST = 1500;
    var currentContext = [];
    var currentRepoCommits;
        
    currentContext.CONTEXT_CLONING = "cloning";
    currentContext.CONTEXT_ASK_REMOTE = "askForRemote";
    currentContext.CONTEXT_SHOW_COMMIT = "showCommit";
    
    function selectCurrentLine() {
      var currentLine = currentListTable.getCurrentTR();
      console.log("SEL", currentLine);
          
      if (currentListTable == branchListTable) {
          console.error("TODO: show specific branch commitlog")
      } else if (currentListTable == commitListTable) {
          if (!initCM()) {
              $(".CodeMirror").show();
              myCodeMirror.refresh();
          }
          if (currentContext[0] != currentContext.CONTEXT_SHOW_COMMIT) {
              currentContext.push(currentContext.CONTEXT_SHOW_COMMIT);
          }
          git.renderCommit(currentLine.attr("id"), git.getCurrentRepo(), function(commitTxt) {
            console.log("show commit txt in CM...");
            var commit = currentListTable.getData()[currentListTable.getCurrentIndex()];
            var header = gitDataHelper.commitHeader(commit);
            myCodeMirror.getDoc().setValue(header+commitTxt);
          });
      } else if (rrentListTable == treeviewTable) {
          console.log("select tree item", currentLine)
      }
    }
    
    function initCM() {
      if (!myCodeMirror) {
        console.log("CM init");
        myCodeMirror = CodeMirror(document.querySelector("#mainContainer"), cmConfig);
        $(".CodeMirror").height("50%");
        $("#commitListContainer").height("50%");
        return true;
      } else {
          console.log("nothing to Init, CM already available");
          return false;
      }
    }
    
   function updateStatusBar() {
      var currIdx = currentListTable.getCurrentIndex();
      var size = currentListTable.getData().length;
      var currTr = currentListTable.getCurrentTR();
      if (currentListTable == commitListTable) {
        renderStatusBar([currTr.attr("id"), "-", "commit", currIdx + 1 , "of", size].join(" ")); //+1 because users like to see 1 indexed not zero    
      } else if (currentListTable == branchListTable) {
        renderStatusBar([currTr.attr("id"), "-", "branch", currIdx + 1 , "of", size].join(" ")); //+1 because users like to see 1 indexed not zero    
      } else if (currentListTable == treeviewTable) {
        renderStatusBar([currTr.attr("id"), "-", "file", currIdx + 1 , "of", size].join(" ")); //+1 because users like to see 1 indexed not zero
      }
      else {
          console.error("no match", currentListTable);
      }
    }
    
    function renderStatusBar(str) {
      $("#statusbar").text(str);
    }

    function moveSelLine(direction) {
      if (currentContext[0] == currentContext.CONTEXT_CLONING) {
          showError("cannot navigate - clone in progress");
          return; //no user input while cloning
      }
      var nuLine;
      switch (direction) {
        case "up":
          currentListTable.prev();
        break;
        case "down":
          currentListTable.next();
        break;
        case "home":
          currentListTable.first();
        break;
        case "end":
           currentListTable.last();
        break;
      }
      updateStatusBar();
    }

    function askForRemote() {
        var repoDir;
        
        function progress (a) { 
            //console.log("clone progress", a);
            var str = a.msg + "["+Math.floor(a.pct)+"%]";
            renderStatusBar(str); 
         }
        function completed (a) { 
            console.log("clone COMPLETED!"+a);
            var c = currentContext.pop();
            if (c != currentContext.CONTEXT_CLONING) {
                console.error("cloning was NOT the current context:"+c);
                if (c) { //if its a valid state, put it back
                    currentContext.push(c);    
                }
            }
            git.setOutDir(repoDir);
            renderStatusBar("Clone Completed!");
            $("#remoteOpen").hide();
            getAndThenShowLog();
        }
        
        currentContext.push(currentContext.CONTEXT_SHOW_COMMIT);
        $("#cancelCloneButton").click(cancelCurrentContext);
        
        $("#helpTextMenu").hide(); //hide away help and show clone ui instead
        $("#remoteOpen").show();
        $("#localParentDir").click(function() {
            git.getFS(function(outDir) {
                var url = $("#remoteUrl").val();
                var dirName = gitDataHelper.getRepoNameFromUrl(url);
                console.log("calc name to be", dirName);
                outDir.getDirectory(dirName, {create:true}, function(nuDir){
                    chrome.fileSystem.getWritableEntry(nuDir, function(writableDir) {
                        repoDir = writableDir;
                        chrome.fileSystem.getDisplayPath(writableDir, function (dispPath) {
                            $("#localParentDir").prop("value",dispPath);
                        });
                        console.log("set repoDir", repoDir);
                    });
                });
            });
        });
        $("#cloneButton").click(function() {
            console.log('CLONE!',  $("#remoteUrl"));
            currentContext.pop();
            currentContext.push(currentContext.CONTEXT_CLONING);
            git.cloneRemote( $("#remoteUrl").val(), repoDir, progress, completed, function(err) {
                showError("Error Cloning: "+err);
            });
        });
    }
    
    function showLog(commitList) {
        var config = {
            pageSize: NUM_COMMIT_LINES,
            data: commitList,
            trRenderer: gitDataHelper.renderTRCommitLogLine,
            tableElem:  document.querySelector("#commitList")
        };
        //setup the commitList
        commitListTable = new PagedTable(config);
        currentListTable = commitListTable;
        $("#branchList").hide();
        $("#treeview").hide();
        $("#commitList").show();
        updateStatusBar();
    }
    
    function showBranches() {        
        git.getAllBranches(function(heads) {
            console.log("HEADS", heads);
            var headsData = heads.concat();
            var config = {
                pageSize: NUM_COMMIT_LINES,
                data: headsData,
                trRenderer: gitDataHelper.renderTRBranchLine,
                tableElem:  document.querySelector("#branchList")
            };
            heads.asyncEach(function(head, done, i) {
               git.getShaForHead(head, function(sha) {
                     headsData[i] = { "name" : headsData[i], "sha" : sha };
                     done();
                   }, function(err) {
                   console.error("err getting sha for head for:"+head, err);
                   showError("Error getting SHA for at lest 1 HEAD in branch list");
                   done();
               }) 
            }, showTable);
            
            function showTable() {
                //setup the commitList
                branchListTable = new PagedTable(config);            
                console.log("setup branch table")     
                $("#commitList").hide();
                $("#treeview").hide();
                $("#branchList").show();
                currentListTable = branchListTable;
                updateStatusBar();    
            }
            
        }, function(err) {
            showError(err);
        });
    }
    
    function showCommits() {
        showLog(currentRepoCommits);
    }
    
    function chooseFSForLocalRepo() {
        if (currentContext[0] == currentContext.CONTEXT_CLONING) {
            showError("cannot open repo while clone in progress");
        }
        git.getFS(getAndThenShowLog);
    }
    
    function getAndThenShowLog() {
        //show commit log...
        git.getLog(MAX_COMMIT_HIST, function(commits) {
            $("#remoteOpen").hide(); //hide clone-repo ui in case it was open
            currentRepoCommits = commits;
            showLog(commits);
        });
    }
    
    function cancelCurrentContext() {
        console.log("CXT CANCEL", currentContext);
        switch(currentContext.pop()) {
            case currentContext.CONTEXT_ASK_REMOTE:
                $("#remoteOpen").hide();
                $("#helpTextMenu").show();
            break;
            case currentContext.CONTEXT_SHOW_COMMIT:
                $(".CodeMirror").hide();
            break;
            case currentContext.CONTEXT_CLONING:
                console.log("cancelling clone-in-progress - TODO");
                //TODO
            break;
            default:
                console.error("invalid context cancel");
            return;
        }
    }
    
    function showTree() {
      var currentLine = currentListTable.getCurrentTR();
      console.log("SEL", currentLine);
      if (!currentLine) {
           console.error("no currentLine - cannot show tree!")
           return;
      } 
      var selectedSHA = currentLine.attr("id");
      var treeData = [];
      
      git.getTreeForCommitSha(selectedSHA, function(tree) {
        var config = {
            pageSize: NUM_COMMIT_LINES,
            data: tree.entries,
            trRenderer: gitDataHelper.renderTRTreeLine,
            tableElem:  document.querySelector("#treeview")
        };  
          
        console.log("got tree for sha:"+selectedSHA, tree);
        treeviewTable = new PagedTable(config); 
        console.log("setup branch table")     
        $("#commitList").hide();
        $("#branchList").hide();
        $("#treeview").show();
        currentListTable = treeviewTable;
        updateStatusBar();    
      });
    }
        
    function showError(str) {
        console.log("show user err:"+str);
        $("#errorbar").text(str);
    }
    
    return {
        moveSelLine: moveSelLine,
        selectCurrentLine: selectCurrentLine,
        askForRemote: askForRemote,
        chooseFSForLocalRepo: chooseFSForLocalRepo,
        cancelCurrentContext: cancelCurrentContext,
        showBranches: showBranches,
        showCommits: showCommits,
        showTree: showTree
    };
});