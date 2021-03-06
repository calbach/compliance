/**
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


//
// Test utility functions
//

$.ajaxSetup({
  contentType: 'application/json; charset=utf-8'
});

function error(runner, message) {
  runner.fatalErrors.push(message);
}

function checkHttpError(runner, json, xhr) {
  if (!_.isUndefined(json.status)) {
    var status = json.status;
    if (status == 0) {
      status = 'This backend isn\'t callable, it may not support ' +
        'CORS. See http://enable-cors.org/server.html';
    }
    error(runner, 'Http error: ' + json.statusText + ' (' + status + ')');
  }
  runner.json.push({
    url: xhr.type + ' ' + xhr.url,
    data: xhr.data,
    json: json});
}

function assert(runner, test, message) {
  var warning = !test;
  runner.tests.push({message: message, warning: warning});
  return warning;
}

var fieldTypes = ['string', 'long', 'date', 'array', 'keyvalue', 'int', 'boolean'];
function assertField(runner, fieldValue, fieldName, expectedFieldValue) {
  if (_.isUndefined(expectedFieldValue)) {
    expectedFieldValue = 'string';
  }

  if (_.contains(fieldTypes, expectedFieldValue)) {
    // If our expectedFieldValue is just a generic type, then we'll
    // only check that the type is correct, and missing values are allowed
    assertFieldType(runner, fieldValue, fieldName, expectedFieldValue);
  } else {
    // Otherwise, our fieldValue should exactly equal the expected value
    assert(runner, fieldValue == expectedFieldValue &&
      typeof fieldValue == typeof expectedFieldValue,
      'Field ' + fieldName + ' is ' + expectedFieldValue);
  }
}

function assertFieldType(runner, fieldValue, fieldName, fieldType) {
  var valueExists = !_.isUndefined(fieldValue);

  if (valueExists) {
    var test;
    if (fieldType == 'long') {
      // Longs in json are typically formatted as strings,
      // yet should be parseable as numbers
      test = !_.isNaN(parseInt(fieldValue));

    } else if (fieldType == 'date') {
      // Check that our date is after the year 2000 - and before 2050,
      // otherwise it's probably malformed
      var date = new Date(parseInt(fieldValue));
      test = date.getYear() > 100 && date.getYear() < 150;
      fieldType += ' in milliseconds since the epoch';

    } else if (fieldType == 'array') {
      // typeof doesn't work on arrays
      test = _.isArray(fieldValue);

    } else if (fieldType == 'keyvalue') {
      // This is the json version of the GAKeyValue object
      test = _.isObject(fieldValue) && _.every(fieldValue, function(v, k) {
        return _.isArray(v) && typeof v[0] == 'string' && typeof k == 'string';
      });

    } else {
      if (fieldType == 'int') {
        fieldType = 'number';
      }
      test = typeof fieldValue == fieldType;
    }
    assert(runner, test, 'Field ' + fieldName + ' is a ' + fieldType);

  } else {
    // TODO: Distinguish optional fields from required ones
    // For now we will mark the field as successful if it's missing
    assert(runner, true,
      'Field ' + fieldName + ' is missing so the type can\'t be tested');
  }
}

function assertFields(runner, object, prefix, fields) {
  _.each(fields, function(name) {
    var type = 'string';
    if (_.isArray(name)) {
      type = name[1];
      name = name[0];
    }
    assertField(runner, object[name], prefix + name, type);
  });
}

function assertArrayObject(runner, parent, objectName, prefix, fields) {
  var objects = parent[objectName] || [];
  var field = prefix + objectName;
  assert(runner, objects.length > 0, 'Field ' + field + ' is non-empty');
  assertFields(runner, _.first(objects) || {}, field + '.', fields);
}

function getUrl(path) {
  var l = document.createElement('a');
  l.href = $('#endpoint').val();

  // Strip off a trailing `/` if present
  var lastPathPosition = l.pathname.length - 1;
  if (l.pathname.lastIndexOf("/") == lastPathPosition) {
    l.pathname = l.pathname.substring(0, lastPathPosition) + path;
  } else {
    l.pathname += path;
  }

  return l.href;
}


//
// Test result UI
//

function addResultDiv(results, test, runner) {
  var div = $('<div/>', {class: 'result'}).appendTo(results);
  var header = getTestHeader(test, runner.runningTime).appendTo(div);

  var details = $('<div/>', {id: test.id, class: 'collapse'})
    .appendTo(div);

  var score = 0;
  _.each(runner.tests, function(x) {
    var row = $('<div/>', {class: 'row'}).appendTo(details);
    $('<div/>', {class: 'test col-xs-10'}).text(x.message).appendTo(row);

    var icon = 'glyphicon glyphicon-remove';
    if (!x.warning && runner.fatalErrors.length == 0) {
      icon = 'glyphicon glyphicon-ok';
      score++;
    }
    $('<div/>', {class: 'status col-xs-2'}).appendTo(row)
      .append($('<span/>', {class: icon}));
  });


  if (runner.fatalErrors.length > 0) {
    _.each(runner.fatalErrors, function(x) {
      $('<div/>', {class: 'fatalError'}).text(x).appendTo(details);
    });
    $('<div/>').text('Testing could not complete due to errors')
      .appendTo(details);
  }

  $('<a/>').text('Debug json').appendTo(details).click(function() {
      $('#' + test.id + ' .debugJson').toggle();
    });
  _.each(runner.json, function(json) {
    $('<pre/>', {class: 'debugJson'}).text(
        'Request: ' + json.url + '\n' + json.data
        + '\n\nResponse: ' + JSON.stringify(json.json, null, 2))
      .appendTo(details).hide();
  });

  var total = runner.tests.length;
  $('<div/>', {class: 'score pull-right ' + scoreColor(total, score)})
    .text(scoreLabel(total, score)).prependTo(header);

  return score;
}

function scoreLabel(total, score) {
  if (score == total) {
    return total;
  } else {
    return score + '/' + total;
  }
}

function scoreColor(total, score) {
  var fraction = score/total;
  if (fraction == 0) {
    return 'error'
  } else if (fraction == 1) {
    return 'perfect';
  } else if (fraction > .5) {
    return 'high';
  } else {
    return 'low';
  }
}

function getTestHeader(test, runningTime) {
  var header = $('<div/>', {class : 'header',
    'data-toggle' : 'collapse', 'data-target': '#' + test.id});
  var title = $('<div/>', {class: 'title'}).text(test.title).appendTo(header);

  $('<a/>', {href: test.docLink, class: 'glyphicon glyphicon-file',
    target: '_blank', title: 'API Documentation'})
    .appendTo(title).click(function(e) {
      e.stopPropagation();
    });

  $('<div/>', {class: 'description'}).text(test.description).appendTo(header);
  $('<div/>', {class: 'runningTime'}).text(runningTime + ' milliseconds')
    .appendTo(header);

  return header;
}


//
// Test execution
//

var tests = [];
function registerTest(title, description, docLink, testFunction) {
  var testId = title.replace(/[ \(\)\.]/g, "-");
  tests.push({id: testId, title: title,
    description: description, docLink: docLink, testFunction: testFunction});
}

function runTests() {
  var results = $('#results').empty();
  var formButton = $('#formButton').button('loading');
  var overallScore = $('#overallScore').empty();
  var datasetId = $('#datasetId').val();

  var totalScore = 0;
  var totalPoints = 0;

  var testsFinished = 0;
  function testFinished(test, testRunner) {
    totalPoints += testRunner.tests.length;
    totalScore += addResultDiv(results, test, testRunner);
    testsFinished++;

    if (testsFinished == tests.length) {
      formButton.button('reset');
      $('<div/>').text('this API scores').appendTo(overallScore);
      $('<div/>').text(totalScore)
        .attr('class', scoreColor(totalPoints, totalScore))
        .appendTo(overallScore);
      $('<div/>').text('out of ' + totalPoints + ' points')
        .appendTo(overallScore);
    }
  }

  _.each(tests, function(test) {
    var testRunner = {datasetId: datasetId, fatalErrors: [],
      tests: [], json: [], startTime: new Date()};
    // The console gives the most accurate running time, but doesn't
    // work on all browsers and doesn't actually return a timing result
    console && console.time && console.time(test.id);

    testRunner.testFinished = function() {
      console && console.timeEnd && console.timeEnd(test.id);
      testRunner.runningTime = new Date() - testRunner.startTime;
      testFinished(test, testRunner);
    };
    test.testFunction(testRunner);
  });
}