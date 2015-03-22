(function() {
    'use strict';
    var isGrouped = false;
    var isDisabled = false;
    var activeTabId = undefined;
    var allData = [];
    var groupedData = {};

    function TabData(id, url, parent) {
        this.id = id;
        this.url = url;
        this.parent = parent;
        this.isParent = parent? false: true;
    }
    
    var utils = {
        isParent: function(id) {
            var parent = false;
            for(var i in allData) {
                if(allData[i].id === id) {
                    parent = allData[i].isParent;
                    break;
                }
            }
            return parent;
        },
        
        exists: function(id) {
            var exists = false;
            for(var i in allData) {
                if(allData[i].id === id) {
                    exists = true;
                    break;
                }
            }
            return exists;
        },
        
        updateTab: function(id, url) {
            for(var i in allData) {
                if(allData[i].id === id) {
                    allData[i].url = url;
                    break;
                }
            }
        },
        
        addTab: function(id, url, parent) {
            var newTab = new TabData(id, url, parent);
            allData.push(newTab);
        },
        
        removeTab: function(id) {
            for(var i in allData) {
                if(allData[i].id === id) {
                    allData.splice(i, 1);
                } else if(allData[i].parent === id) {
                    allData[i].parent = undefined;
                }
            }
        },
        
        makeParent: function(id) {
            for(var i in allData) {
                if(allData[i].id === id) {
                    allData[i].isParent = true;
                    allData[i].parent = undefined;
                    break;
                }
            }
        },
        addOrUpdate: function(tab) {
            
            if(tab.url.indexOf('chrome-devtools://') !== -1) {
                return;
            }
            var isParent = tab.url.indexOf('chrome://') === 0;
            if(utils.exists(tab.id)) {
                utils.updateTab(tab.id, tab.url);
                console.log('updating')
            } else {
                utils.addTab(tab.id, tab.url, isParent? undefined: tab.openerTabId);
                if(!isParent) {
                    utils.makeParent(tab.openerTabId);
                }
            }
        },
        
        group: function() {
            var canGroupData = [];
            var tabsToClose = [];
            if(!isDisabled && allData.length > 7) {
                for(var i in allData) {
                    if(allData[i].id !== activeTabId && allData[i].parent !== activeTabId) {
                        canGroupData.push(allData[i]);
                    }
                }
                
                for(var j in canGroupData) {
                    var key = canGroupData[j].parent || canGroupData[j].id;
                    if(groupedData[key] && canGroupData[j].parent) {
                        groupedData[key].push(canGroupData[j]);
                        tabsToClose.push(canGroupData[j].id);
                    } else if(!groupedData[key] && canGroupData[j].parent) {
                        groupedData[key] = [canGroupData[j]];
                        tabsToClose.push(canGroupData[j].id);
                    } else if(!groupedData[key]) {
                        groupedData[key] = [];
                    }
                }
                
                isGrouped = true;
                chrome.tabs.remove(tabsToClose);
            }
        },
        
        unGroup: function(id) {
            if(groupedData[id]) {
                var tabsToUngroup = groupedData[id];
                var parentIndex = undefined;
                chrome.tabs.get(id, function(tab) {
                    parentIndex = tab.index;
                    for(var t in tabsToUngroup) {
                        chrome.tabs.create({
                            index: parentIndex + parseInt(t) + 1,
                            active: false,
                            selected: false,
                            url: tabsToUngroup[t].url,
                            openerTabId: id
                        });
                    }
                    delete groupedData[id];
                });
            }
        },
        
        unGroupAll: function() {
            for(var id in groupedData) {
                utils.unGroup(id);
            }
        }
    };
    
    /*chrome.tabs.onCreated.addListener(function(tab) {
        utils.addOrUpdate(tab);
        utils.group();
    });*/
    
    chrome.tabs.onUpdated.addListener(function(tabId, opts, tab) {
        if(opts.status === 'complete') {
            utils.addOrUpdate(tab);
            utils.group();
        }
    });
    
    chrome.tabs.onRemoved.addListener(function(tabId) {
        utils.removeTab(tabId);
    });
    
    chrome.tabs.onActivated.addListener(function(opts) {
        activeTabId = opts.tabId;
        if(isGrouped && groupedData[activeTabId]) {
            utils.unGroup(activeTabId);
        }
    });
    
    chrome.runtime.onInstalled.addListener(function(details){
        chrome.tabs.query({}, function(tabs) {
            for(var i in tabs) {
                utils.addOrUpdate(tabs[i]);
            }
            utils.group();
        });
    });
    
})();