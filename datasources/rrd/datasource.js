define([
  'angular',
  'lodash',
  'kbn',
  'moment',
  './queryCtrl'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('RRDDatasource', function($q, backendSrv, templateSrv) {

    function RRDDatasource(datasource) {
      this.type = 'rrd';
      this.url = datasource.url;
      this.name = datasource.name;
      this.supportMetrics = true;
    }

    // Called once per panel (graph)
	RRDDatasource.prototype.query = function(options) {
		var start = convertToRRDTime(options.range.from);
		var end = convertToRRDTime(options.range.to);
		var qs = [];

		_.each(options.targets, function(target) {
			if (target.metric && !target.hide) {
				qs.push({
					metric: templateSrv.replace(target.metric),
					consolidation: (target.aggregator) ? templateSrv.replace(target.aggregator) : "average"
				});
			}
		});

		var queries = _.compact(qs);

		// No valid targets, return the empty result to save a round trip.
		if (_.isEmpty(queries)) {
			var d = $q.defer();
			d.resolve({ data: [] });
			return d.promise;
		}

		return this.performTimeSeriesQuery(queries, start, end, options.interval).then(function(response) {
			var metricToTargetMapping = mapMetricsToTargets(response.data, options.targets);
			var result = _.map(response.data, function(metricData, index) {
				index = metricToTargetMapping[index];
				return transformMetricData(metricData, options.targets[index]);
			});
			return { data: result };
		});
	};

	RRDDatasource.prototype.performTimeSeriesQuery = function(queries, start, end, resolution) {
		var reqBody = {
			start: start,
			resolution: resolution,
			queries: queries
		};

		// Relative queries (e.g. last hour) don't include an end time
		if (end) {
			reqBody.end = end;
		}
      
		var options = {
			method: 'POST',
			url: this.url + '/query',
			data: reqBody
		};

		return backendSrv.datasourceRequest(options);
	};

    RRDDatasource.prototype.suggestMetricQuery = function(query, recursive) {
      var options = {
        method: 'GET',
        url: this.url + '/suggest/metrics',
        params: {
          query:      query,
          recursive:  recursive
        }
      };
      
      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      });        
    };
    
    function transformMetricData(md, options) {
      var label =  (!_.isUndefined(options) && options.alias) ? options.alias : (md.metric + " (" + options.aggregator + ")");
      var values = [];

      // RRD server returns datapoints has a hash of ts => value.
      // Can't use _.pairs(invert()) because it stringifies keys/values
      _.each(md.result, function (v, k)
      {
        values.push([v, k * 1000]);
      });

      return { target: label, datapoints: values };
    }

	function mapMetricsToTargets(metrics, targets) {
		return _.map(metrics, function(metricData) {
			return _.findIndex(targets, function(target) {
				return target.metric === metricData.metric &&
					   target.aggregator.toUpperCase() === metricData.consolidation.toUpperCase();
				});
		});
	}


    function convertToRRDTime(date) {
      if (date === 'now') {
        return null;
      }

      date = kbn.parseDate(date);

      return date.getTime();
    }

    return RRDDatasource;
  });

});
