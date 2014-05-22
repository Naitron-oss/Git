define(['js/git-cmds', 'utils/file_utils', 'formats/dircache'], function(git, fileUtils, DirCache) {
   module("Core Tests");
    
    test("require.js needed", function() {
       expect(1);
       equals(typeof require, "function", "require function must be available");
    });

    test("check requirejs loading", function() {
        expect(1);
        equals(typeof git.cloneRemote, "function", "clone function should exist");
    });
    
    asyncTest("check can do XHR", function() {
       expect(1);
       function reqListener () {
          equal(this.responseText.trim(), "pong", "expect correct res text from server"); 
          start();
        }
        var oReq = new XMLHttpRequest();
        oReq.onload = reqListener;
        oReq.open("get", "http://manichord.com/ping", true);
        oReq.send();
    });
    
    asyncTest("check can do Basic Auth XHR", function() {
       expect(1);
       
       var authCreds = "maks:test1";
       var oReq = new XMLHttpRequest();
       
       function reqListener () {
          if (this.status == 200) {
            equal(this.responseText.trim(), "super", "expect correct res text from server");
            start();    
          } else if (this.status == 401) {
              oReq = new XMLHttpRequest();
              oReq.onload = reqListener;
              oReq.open("get", "http://manichord.com/auth-test/secret", true);
              oReq.setRequestHeader("Authorization", "Basic "+btoa(authCreds));
              oReq.send();
          }
        }
        
        oReq.onload = reqListener;
        oReq.open("get", "http://manichord.com/auth-test/secret", true);
        oReq.send();
    });
    
    module("Git Dircache Tests");
    
    asyncTest("read index file test", function() {
       expect(3);
       //for now need to call as getLog is actually where the filestore (currentrepo) is init'd, doh! :-( 
       git.getLog(10, null, function() {
            equal(typeof git.getCurrentRepo(), "object", "expect to have a local repo set");
            git.getDircache(function(dircache) {
                equal(typeof dircache, "object", "dircache must be available");
                equal(dircache.getEntry(".gitignore").path, ".gitignore", "got .gitignore");
                start();
            }, function(e) { ok(false, "Error getting Dircache: "+JSON.stringify(e)); start(); });    
       }, function(e) { ok(false, "Error getting Log:"+JSON.stringify(e)); start(); });
    });
        
    test("create index binary", function() {
       var dc = new DirCache();
       var path1 = "foo/bar1";
       var emptySha = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
       var eDate1 = new Date();
       var eSize1 = 1234;
       
       dc.addEntry(path1, emptySha, eDate1, eSize1);
       
       var bin = dc.getBinFormat();
       ok(bin instanceof ArrayBuffer)
       equal(bin.byteLength, 104, "entry must be correct size");

       var dc2 = new DirCache(bin);
       equal(dc2.entriesCount(), 1, "expect 1 entry");
       var entry1 =  dc2.getEntry(path1);
       equal(typeof entry1, "object", "expect 1 entry object");
       equal(emptySha, entry1.sha, "expect correct sha");
       equal(entry1.modTime.getTime(), eDate1.getTime(), "expect correct time");
       equal(eSize1, entry1.size, "expect correct size"); 
    });
    
    asyncTest("write index on checkout", function() {
        var testDataBlobSha = ["8e532033f25d949ae9b2ca4d882f66bd9ca40384"]; //has output of git ls-files for commit we are using here
        var ref = "49df7f2085391a28fc37aa056f5c0064f0040482";
        var testDataStr;
        
        function doCheckout() {
            git.getCurrentRepo()._retrieveBlobsAsStrings(testDataBlobSha, function(arrOfTxts) {
               console.log("got back blobs", arrOfTxts);
               testDataStr = arrOfTxts[0].data;
               git.checkoutSha(ref, function(){
                    console.log("write index checked out "+ref);
                    // now compare to test data
                    git.getDircache(function(dircache) {
                        var sortedEntries = testDataStr.split("\n");
                        equal(dircache.entriesCount(), sortedEntries.length, "number of entries must be correct");
                        var ourSortedEntryPaths = dircache.getSortedEntryPaths();
                        for (var i = 0; i < ourSortedEntryPaths.length; i++) {
                            //compare our order of entries vs how cgit did it in the test data
                            if (ourSortedEntryPaths[i] !== sortedEntries[i]) { //do this otherwise our number of tests is huge
                                equal(ourSortedEntryPaths[i], sortedEntries[i], "entries must be sorted in order Git specs");
                            }
                        }
                        equal(ourSortedEntryPaths[ourSortedEntryPaths.length-1], sortedEntries[sortedEntries.length-1], 
                            "entries must be sorted in order Git specs");
                        start();
                    });
                }, function(e) { ok(false, "ERROR Checking out "+ref+" "+JSON.stringify(e)); start(); });
            });
        };
        
        git.getLog(10, null, function() {
            //need to first have somethign else checked to force deteached checkout of the commit in our test
            git.checkoutRef("refs/heads/master", function() {
                doCheckout();
            }) 
        });
    });
});


