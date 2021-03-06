'use strict';
angular.module('blApp.dataSense.controllers')
    .controller('CustomDimensionController',
        ['$scope', '$rootScope', '$uibModalInstance', '$timeout', '$q', 'selectedWidget',
        'widgetType', 'TagService', 'utilService',
        function ($scope, $rootScope, $uibModalInstance, $timeout, $q, selectedWidget,
            widgetType, TagService, utilService) {

            $scope.newGroup = {
                'name': '',
                'segmentId': $rootScope.selectedDashboard.segments[0].id,
                'treedata': []
            };

            $scope.customGroupDimension = {
                'groupBySegment': selectedWidget.customGroupDimension.groupBySegment || false,
                'definedGroups': selectedWidget.customGroupDimension.definedGroups || []
            };
            
            $scope.isGroupDisabled = (widgetType === 'Pie' ? false : true);
            $scope.added = false;
            $scope.applied = false;
            $scope.newSegment = [];
            $scope.selectedSegment = [];
            $scope.expandedNodes = [];
            $scope.isExpanded = true;
            $scope.isAllSegments = false;
            $scope.allowAutoActivate = true;
            $scope.isBuild = false;
            $scope.tagBindings = [];
            $scope.levelTagMap = {
                1: 'Metric',
                2: 'Node',
                3: 'Scope',
                4: 'Facility'
            };
            
            $scope.submit = function() {
                $scope.applied = true;

                /*if (!$scope.customGroupDimension.definedGroups.length) {
                    utilService.errorNotify('Please add Custom Group Dimensions.');
                    return;
                }*/

                $uibModalInstance.close($scope.customGroupDimension);
                $scope.applied = false;
            };

            $scope.addNewGroup = function(form) {
                $scope.added = true;

                if (form.$invalid) {
                    return;
                }

                var definedGroup = {};
                angular.copy($scope.newGroup, definedGroup);
                $scope.getAllTagsSegment();
                definedGroup.tagBindings = [];
                angular.copy($scope.tagBindings, definedGroup.tagBindings);
                definedGroup.isExpanded = false;
                definedGroup.expandedNodes = [];
                angular.copy($scope.expandedNodes, definedGroup.expandedNodes);
                
                $scope.customGroupDimension.definedGroups.push(definedGroup);

                $scope.newGroup.name = '';

                $scope.added = false;
            };

            $scope.dismiss = function () {
                $scope.applied = false;
                $uibModalInstance.dismiss('cancel');
            };

            /**
             * Building new tree based on current user's datasource, it is using recurive procedure for configuring tree
             * @param {string}
             * @return {object}
             */
            $scope.buildNewSegmentTree = function() {
                var deferred = $q.defer();

                TagService.listAccessibleTagsByUser($rootScope.currentUser._id).then(function(tags) {
                    var facilities = tags;
                    if (!$scope.isBuild) {
                        //console.log('Current User Data Source');
                        //console.log(facilities);

                        $scope.newSegment = [];
                        $scope.newGroup.treedata = [];
                        //$scope.expandedNodes.splice(0, $scope.expandedNodes.length);

                        angular.forEach(facilities, function(childDataSource, index) {
                            $scope.recursiveUserDataSourceProc(childDataSource, '', $scope.newSegment);
                        });

                        //$scope.readyUserDataSource = true;
                        angular.copy($scope.newSegment, $scope.newGroup.treedata);

                        $scope.isBuild = true;
                    }
                    deferred.resolve(facilities);
                }, function () {
                    deferred.reject('The requested api call has faild');
                });

                return deferred.promise;
            };

            /**
             * Recursive procedure for building new tree based on current dashboard's datasource
             * @param {string} rootId Current User ID
             * @return {object}
             */
            $scope.recursiveSegmentProc = function(tag, callback) {
                $scope.selectedSegmentDataSourceIds.push(tag.id);
                return false;
            };

            /**
             * Recursive procedure for building new tree based on current user's datasource
             * @param {string}
             * @return {object}
             */
            $scope.recursiveUserDataSourceProc = function(datasource, parentId, parentObj) {
                var childs = [];
                var treeitem = {};

                treeitem.id = datasource.tagType.toLowerCase() + '_' + datasource._id;
                treeitem.name = datasource.name;
                treeitem.visible = false;
                treeitem.disable = true;
                treeitem._id = datasource._id;
                treeitem.children = [];
                treeitem['parent_id'] = parentId;

                switch(datasource.tagType.toLowerCase()) {
                    case 'facility':
                        treeitem.type = 'facility';
                        treeitem.level = 4;
                        break;
                    case 'scope':
                        treeitem.type = 'scope';
                        treeitem.level = 3;
                        break;
                    case 'node':
                        treeitem.type = 'node';
                        treeitem.level = 2;
                        break;
                    case 'metric':
                        treeitem.type = 'dmetric';
                        treeitem.level = 1;
                        break;
                }
                childs = datasource.childTags;

                parentObj.push(treeitem);

                /*if($scope.isExpanded)
                    $scope.expandedNodes.push(treeitem);*/

                if (datasource.tagType.toLowerCase() === 'metric' || !childs.length) {
                    return true;
                }

                angular.forEach(childs, function(childDataSource, index) {
                    $scope.recursiveUserDataSourceProc(childDataSource, datasource._id, treeitem.children);
                });

                return false;
            };

            /**
             * Set active stats. this proc is similar to setVisibleStats.
             * Only the difference is to set stats by comparing ids with given 'stats' array
             * @param {string} rootId Current User ID
             * @return {object}
             */
            $scope.setVisibleStatsWith = function(treedata, stats, parentStat) {
                var isChildExpanded = false;
                var isSelectedDS = false;
                if(!treedata.children) {
                    return (stats.indexOf(treedata._id) === -1) ? false : true;
                }

                if (!parentStat) {
                    isSelectedDS = treedata.visible = (stats.indexOf(treedata._id) === -1) ? false : true;
                    treedata.disable = !treedata.visible;
                } else {
                    treedata.visible = true;
                    treedata.disable = false;
                }
                parentStat = treedata.visible;

                angular.forEach(treedata.children, function(treeitem, index){
                    if ( $scope.setVisibleStatsWith(treeitem, stats, parentStat) ) {
                        isChildExpanded = true;
                    }
                });
                if ( isChildExpanded ) {
                    $scope.expandedNodes.push(treedata);
                }
                return isChildExpanded || isSelectedDS;
            };

            /**
             * Set active stats (in tree, it means set visible flag) in sub tree.
             * Every child's active stat will depends on the parent's stat
             * @param {string} rootId Current User ID
             * @return {object}
             */
            $scope.setVisibleStats = function(treedata, visible) {
                if(!treedata.children) {
                    return true;
                }

                treedata.visible = visible ;

                angular.forEach(treedata.children, function(treeitem, index) {
                    $scope.setVisibleStats(treeitem, visible);
                });

                return false;
            };

            /**
             * Auto merging active status through specified subtree (or all tree) with treedata
             * If all children activated, the parent will be active as well.
             * Otherwise, in case of all deactivated, will work vise-versa
             * @param {obj} treedata Current User ID
             * @param {parentStat} parentStat Current User ID
             * @return {object}
             */
            $scope.autoVisibleStats = function(treedata, parentStat) {
                if(!treedata.children.length) {
                    return treedata.visible;
                }

                parentStat = true;
                angular.forEach(treedata.children, function(treeitem, index) {
                    if (parentStat  && $scope.autoVisibleStats(treeitem, parentStat)) {
                        parentStat = true;
                    } else {
                        parentStat = false;
                    }
                });
                treedata.visible = parentStat;

                return treedata.visible;
            };

            /**
             * Load active/deactive status for selected segment's datasources
             * Process active/deactive stats on segment tree by setting visible flag
             * @param {string} segmentId Selected Segment ID
             * @return {object}
             */
            $scope.processActiveDataSource = function(segmentId) {
                //$scope.expandedNodes.splice(0, $scope.expandedNodes.length);
                var segments = $rootScope.selectedDashboard.segments;
                $scope.selectedSegment = {};
                var stats;

                $scope.selectedSegmentDataSourceIds = [];
                for(var index = 0; index < segments.length; index++) {
                    if(segments[index].id === segmentId) {
                        $scope.selectedSegment = segments[index];
                    }
                }
                
                angular.copy($scope.newSegment, $scope.newGroup.treedata);
                angular.forEach($scope.selectedSegment.tagBindings, function(tag, index) {
                    $scope.recursiveSegmentProc(tag);
                });

                stats = $scope.selectedSegmentDataSourceIds;
                angular.forEach($scope.newGroup.treedata, function(treeitem, index) {
                    $scope.setVisibleStatsWith(treeitem, stats, false);
                });
                angular.forEach($scope.newGroup.treedata, function(treeitem, index) {
                    $scope.autoVisibleStats(treeitem, true);
                });

            };

            /**
             * Update active/deactive status for event taget
             * @param {string} rootId Current User ID
             * @return {object}
             */
            $scope.activateDataSource = function(e, source) {
                var visible = !source.visible;
                $scope.setVisibleStats(source, visible);
                if ($scope.allowAutoActivate) {
                    angular.forEach($scope.newGroup.treedata, function(treeitem, index) {
                        $scope.autoVisibleStats(treeitem, true);
                        $scope.getTagBindings(treeitem);
                    });
                }
            };

            /**
             * Get get all tags for segment
             * @param
             * @return {object}
             */
            $scope.getAllTagsSegment = function() {
                $scope.tagBindings = [];
                angular.forEach($scope.newGroup.treedata, function(treeitem, index) {
                    $scope.getTagBindings(treeitem);
                });
            };

            /**
             * Get actived tagBindings
             * @param tag data
             * @return {object}
             */
            $scope.getTagBindings = function(tag) {
                var tagType;
                if(tag.visible === true) {
                    switch(tag.type) {
                        case 'facility':
                            tagType = 'Facility';
                            break;
                        case 'scope':
                            tagType = 'Scope';
                            break;
                        case 'node':
                            tagType = 'Node';
                            break;
                        case 'dmetric':
                            tagType = 'Metric';
                            break;
                    }
                    var newTag = {
                        'tagType': tagType,
                        'id': tag._id
                    };
                    $scope.tagBindings.push(newTag);
                    return true;
                } else {
                    if(!tag.children) {
                        return true;
                    }
                    angular.forEach(tag.children, function(child, index) {
                        $scope.getTagBindings(child);
                    });
                }

                return false;
            };

            /**
             * change Segment tree on selection of Segment
             * @param none
             * @return none
             */
            $scope.changeSegmentId = function() {
                console.log('finished building new segment tree');
                $scope.processActiveDataSource($scope.newGroup.segmentId);
            };

            $scope.changeCDExpanded = function(idx) {
                if(!$scope.customGroupDimension.definedGroups[idx].isExpanded) {
                    angular.forEach($scope.customGroupDimension.definedGroups, function(group, index) {
                        group.isExpanded = false;
                    });
                }
                $scope.customGroupDimension.definedGroups[idx].isExpanded 
                    = !$scope.customGroupDimension.definedGroups[idx].isExpanded;
            };

            $scope.removeDefinedGroup = function(idx) {
                //$scope.customGroupDimension.definedGroups[idx].isDeleted = true;
                $scope.customGroupDimension.definedGroups.splice(idx, 1);
            };

            /**
             * Building new tree based on current user's datasource, it is using recurive procedure for configuring tree
             * @param {string}
             * @return {object}
             */
            $scope.buildNewSegmentTree().then(function(result) {
                $timeout(function() {
                    console.log('finished building new segment tree');
                    $scope.processActiveDataSource($scope.newGroup.segmentId);
                }, 50);
            });
           
        }
    ]);
