define([
  'angular',
  'lodash',
  'kbn'
],
function (angular, _, kbn) {
	'use strict';

	var module = angular.module('grafana.controllers');

	module.controller('RRDQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q) {
	$scope.init = function() {
		$scope.segments = [];
		$scope.showTextEditor = false;
		$scope.aggregators = ['average', 'min', 'max', 'last'];
 
		if (!$scope.target.aggregator) {
			$scope.target.aggregator = 'average';
		}
       
       console.log("LOAD:", $scope.target.metric);
       if ($scope.target.metric) {
			_.each($scope.target.metric.split("/"), function(m) {
				$scope.segments.push(new MetricSegment({ value: m}));
			});
		}
       
		rebuildSegments(0);
	};

	$scope.toggleQueryMode = function () {
		$scope.target.rawQuery = !$scope.target.rawQuery;
	};

	$scope.moveMetricQuery = function(fromIndex, toIndex) {
		_.move($scope.panel.targets, fromIndex, toIndex);
		$scope.$parent.get_data();
	};

	$scope.duplicate = function() {
		var clone = angular.copy($scope.target);
		$scope.panel.targets.push(clone);
		$scope.$parent.get_data();
	};	  
	 
	$scope.textEditorSuggestMetrics = function(query, callback) {
		$scope.datasource.suggestMetricQuery(query, true).then(callback);
	};	
	
	function getSegmentPathUpTo(index) {
		var arr = $scope.segments.slice(0, index);
		return _.reduce(arr, function(res, segment) {
			if (segment.fake) return res;
			return res ? (res + "/" + segment.value) : segment.value;
		}, "");
	}
 
	 function matchSegments(metrics) {
		return _.reduce(metrics, function(res, metric) {
			var items = metric.split("/");
			for (var i=res.count; i<Math.min(items.length, $scope.segments.length); i++) {
				if (items[i] === $scope.segments[i].value) {
					res.count = i + 1;
					res.expandable = items.length -1 > i;
				}
			}
			return res;
		}, {count: 0, expandable: false});
	 }
	 
	 function rebuildSegments(index) {
		
		if ($scope.segments.length === 0) {
			$scope.segments.push(MetricSegment.newSelectHost());
			setSegmentFocus(0);
			return $q.when([]);
		}
		 
		var query = getSegmentPathUpTo(index + 1) + "/";

		if (index === $scope.segments.length -1) {
			return $scope.datasource.suggestMetricQuery(query, false).then(function(results) {
				if (results.length > 0)
					$scope.segments.push(MetricSegment.newSelectMetric());
				
				//setSegmentFocus($scope.segments.length - 1);
			}, function(err) {
				$scope.parserError = err.message || 'Failed to issue metric query';
			});
		}

		return $scope.datasource.suggestMetricQuery(query, true).then(function(metrics) {
			var match = matchSegments(metrics);

			if (match.count < index) {
				$scope.segments = $scope.segments.splice(0, index + 1);
				//setSegmentFocus(index);
			} else {
			
				$scope.segments = $scope.segments.splice(0, match.count);
				if (index === $scope.segments.length -1) {
					if (match.expandable) 
						$scope.segments.push(MetricSegment.newSelectMetric());
				
					//setSegmentFocus($scope.segments.length - 1);
				} else {
					if (match.expandable) 
						$scope.segments.push(MetricSegment.newSelectMetric());

					//setSegmentFocus(index+1);
				}
			}
		}, function(err) {
			$scope.parserError = err.message || 'Failed to issue metric query';
		});
	 }
	 
	$scope.getAltSegments = function (index) {
		$scope.altSegments = [];
 
		var query = getSegmentPathUpTo(index) + "/";
		return $scope.datasource.suggestMetricQuery(query, false).then(function(results) {
			$scope.altSegments = _.map(results, function(metric) {
				return new MetricSegment({ value: metric, expandable: true });
			});
         }, function(err) {
			$scope.parserError = err.message || 'Failed to issue metric query';
		});
	}

	function setSegmentFocus(segmentIndex) { 
		_.each($scope.segments, function(segment, index) {
			segment.focus = segmentIndex === index;
		});
	}

	$scope.segmentValueChanged = function (segment, segmentIndex) {
		delete $scope.parserError;
		return rebuildSegments(segmentIndex).then(function() {
			setSegmentFocus(segmentIndex + 1);
			$scope.targetChanged();
		});
     };
    
     $scope.targetChanged = function() {
		$scope.target.metric = getSegmentPathUpTo($scope.segments.length);
		console.log($scope.target.metric);
		$scope.$parent.get_data();
     }
     
	function MetricSegment(options) {
		this.fake = options.fake;
		this.value = options.value;
		this.expandable = options.expandable;
		this.html = $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
     }    

	MetricSegment.newSelectMetric = function() {
		return new MetricSegment({value: '<i class="fa fa-angle-right"></i>', fake: true});
	};    
	
	MetricSegment.newSelectHost = function() {
		return new MetricSegment({value: 'select host and metric', fake: true});
	}; 

  });

	module.directive('focusMe', function($timeout, $parse) {
		return {
			//scope: true,   // optionally create a child scope
			link: function(scope, element, attrs) {
				var model = $parse(attrs.focusMe);
				scope.$watch(model, function(value) {
					if(value === true) {
						$timeout(function() {
							element[0].focus();
						});
					}
				});
			}
		};
	});
	
});



