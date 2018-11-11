var Plotly = require('@lib/index');
var plotApi = require('@src/plot_api/plot_api');
var Lib = require('@src/lib');
var Axes = require('@src/plots/cartesian/axes');
var subroutines = require('@src/plot_api/subroutines');
var annotations = require('@src/components/annotations');
var images = require('@src/components/images');
var Registry = require('@src/registry');

var d3 = require('d3');
var createGraphDiv = require('../assets/create_graph_div');
var destroyGraphDiv = require('../assets/destroy_graph_div');
var failTest = require('../assets/fail_test');
var supplyAllDefaults = require('../assets/supply_defaults');
var mockLists = require('../assets/mock_lists');
var drag = require('../assets/drag');

var MAPBOX_ACCESS_TOKEN = require('@build/credentials.json').MAPBOX_ACCESS_TOKEN;

describe('@noCIdep Plotly.react', function() {
    var mockedMethods = [
        'doTraceStyle',
        'doColorBars',
        'doLegend',
        'layoutStyles',
        'doTicksRelayout',
        'doModeBar',
        'doCamera'
    ];

    var gd;
    var afterPlotCnt;

    beforeEach(function() {
        gd = createGraphDiv();

        spyOn(plotApi, 'plot').and.callThrough();
        spyOn(Registry, 'call').and.callThrough();

        mockedMethods.forEach(function(m) {
            spyOn(subroutines, m).and.callThrough();
            subroutines[m].calls.reset();
        });

        spyOn(annotations, 'drawOne').and.callThrough();
        spyOn(annotations, 'draw').and.callThrough();
        spyOn(images, 'draw').and.callThrough();
        spyOn(Axes, 'doTicks').and.callThrough();
    });

    afterEach(destroyGraphDiv);

    function countPlots() {
        plotApi.plot.calls.reset();
        subroutines.layoutStyles.calls.reset();
        annotations.draw.calls.reset();
        annotations.drawOne.calls.reset();
        images.draw.calls.reset();

        afterPlotCnt = 0;
        gd.on('plotly_afterplot', function() { afterPlotCnt++; });
    }

    function countCalls(counts) {
        var callsFinal = Lib.extendFlat({}, counts);
        callsFinal.layoutStyles = (counts.layoutStyles || 0) + (counts.plot || 0);

        mockedMethods.forEach(function(m) {
            expect(subroutines[m]).toHaveBeenCalledTimes(callsFinal[m] || 0);
            subroutines[m].calls.reset();
        });

        // calls to Plotly.plot via plot_api.js or Registry.call('plot')
        var plotCalls = plotApi.plot.calls.count() +
            Registry.call.calls.all()
                .filter(function(d) { return d.args[0] === 'plot'; })
                .length;
        expect(plotCalls).toBe(counts.plot || 0, 'Plotly.plot calls');
        plotApi.plot.calls.reset();
        Registry.call.calls.reset();

        // only consider annotation and image draw calls if we *don't* do a full plot.
        if(!counts.plot) {
            expect(annotations.draw).toHaveBeenCalledTimes(counts.annotationDraw || 0);
            expect(annotations.drawOne).toHaveBeenCalledTimes(counts.annotationDrawOne || 0);
            expect(images.draw).toHaveBeenCalledTimes(counts.imageDraw || 0);
        }
        annotations.draw.calls.reset();
        annotations.drawOne.calls.reset();
        images.draw.calls.reset();

        expect(afterPlotCnt).toBe(1, 'plotly_afterplot should be called only once per edit');
        afterPlotCnt = 0;
    }

    it('can add / remove traces', function(done) {
        var data1 = [{y: [1, 2, 3], mode: 'markers'}];
        var data2 = [data1[0], {y: [2, 3, 1], mode: 'markers'}];
        var layout = {};
        Plotly.newPlot(gd, data1, layout)
        .then(countPlots)
        .then(function() {
            expect(d3.selectAll('.point').size()).toBe(3);

            return Plotly.react(gd, data2, layout);
        })
        .then(function() {
            expect(d3.selectAll('.point').size()).toBe(6);

            return Plotly.react(gd, data1, layout);
        })
        .then(function() {
            expect(d3.selectAll('.point').size()).toBe(3);
        })
        .catch(failTest)
        .then(done);
    });

    it('should notice new data by ===, without layout.datarevision', function(done) {
        var data = [{y: [1, 2, 3], mode: 'markers'}];
        var layout = {};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            expect(d3.selectAll('.point').size()).toBe(3);

            data[0].y.push(4);
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // didn't pick it up, as we modified in place!!!
            expect(d3.selectAll('.point').size()).toBe(3);
            countCalls({plot: 0});

            data[0].y = [1, 2, 3, 4, 5];
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // new object, we picked it up!
            expect(d3.selectAll('.point').size()).toBe(5);
            countCalls({plot: 1});
        })
        .catch(failTest)
        .then(done);
    });

    it('should notice new layout.datarevision', function(done) {
        var data = [{y: [1, 2, 3], mode: 'markers'}];
        var layout = {datarevision: 1};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            expect(d3.selectAll('.point').size()).toBe(3);

            data[0].y.push(4);
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // didn't pick it up, as we didn't modify datarevision
            expect(d3.selectAll('.point').size()).toBe(3);
            countCalls({plot: 0});

            data[0].y.push(5);
            layout.datarevision = 'bananas';
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // new revision, we picked it up!
            expect(d3.selectAll('.point').size()).toBe(5);

            countCalls({plot: 1});
        })
        .catch(failTest)
        .then(done);
    });

    it('picks up partial redraws', function(done) {
        var data = [{y: [1, 2, 3], mode: 'markers'}];
        var layout = {};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            layout.title = 'XXXXX';
            layout.hovermode = 'closest';
            data[0].marker = {color: 'rgb(0, 100, 200)'};
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({layoutStyles: 1, doTraceStyle: 1, doModeBar: 1});
            expect(d3.select('.gtitle').text()).toBe('XXXXX');
            var points = d3.selectAll('.point');
            expect(points.size()).toBe(3);
            points.each(function() {
                expect(window.getComputedStyle(this).fill).toBe('rgb(0, 100, 200)');
            });

            layout.showlegend = true;
            layout.xaxis.tick0 = 0.1;
            layout.xaxis.dtick = 0.3;
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // legend and ticks get called initially, but then plot gets added during automargin
            countCalls({doLegend: 1, doTicksRelayout: 1, plot: 1});

            data = [{z: [[1, 2], [3, 4]], type: 'surface'}];
            layout = {};

            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // we get an extra call to layoutStyles from marginPushersAgain due to the colorbar.
            // Really need to simplify that pipeline...
            countCalls({plot: 1, layoutStyles: 1});

            layout.scene.camera = {up: {x: 1, y: -1, z: 0}};

            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({doCamera: 1});

            data[0].type = 'heatmap';
            delete layout.scene;
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({plot: 1});

            // ideally we'd just do this with `surface` but colorbar attrs have editType 'calc' there
            // TODO: can we drop them to type: 'colorbars' even for the 3D types?
            data[0].colorbar = {len: 0.6};
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({doColorBars: 1, plot: 1});
        })
        .catch(failTest)
        .then(done);
    });

    it('picks up special dtick geo case', function(done) {
        var data = [{type: 'scattergeo'}];
        var layout = {};

        function countLines() {
            var path = d3.select(gd).select('.lataxis > path');
            return path.attr('d').split('M').length;
        }

        Plotly.react(gd, data)
        .then(countPlots)
        .then(function() {
            layout.geo = {lataxis: {showgrid: true, dtick: 10}};
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({plot: 1});
            expect(countLines()).toBe(18);
        })
        .then(function() {
            layout.geo.lataxis.dtick = 30;
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({plot: 1});
            expect(countLines()).toBe(6);
        })
        .catch(failTest)
        .then(done);
    });

    it('picks up minimal sequence for cartesian axis range updates', function(done) {
        var data = [{y: [1, 2, 1]}];
        var layout = {xaxis: {range: [1, 2]}};
        var layout2 = {xaxis: {range: [0, 1]}};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            expect(Axes.doTicks).toHaveBeenCalledWith(gd, '');
            return Plotly.react(gd, data, layout2);
        })
        .then(function() {
            expect(Axes.doTicks).toHaveBeenCalledWith(gd, 'redraw');
            expect(subroutines.layoutStyles).not.toHaveBeenCalled();
        })
        .catch(failTest)
        .then(done);
    });

    it('redraws annotations one at a time', function(done) {
        var data = [{y: [1, 2, 3], mode: 'markers'}];
        var layout = {};
        var ymax;

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            ymax = layout.yaxis.range[1];

            layout.annotations = [{
                x: 1,
                y: 4,
                text: 'Way up high',
                showarrow: false
            }, {
                x: 1,
                y: 2,
                text: 'On the data',
                showarrow: false
            }];
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            // autoranged - so we get a full replot
            countCalls({plot: 1});
            expect(d3.selectAll('.annotation').size()).toBe(2);

            layout.annotations[1].bgcolor = 'rgb(200, 100, 0)';
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({annotationDrawOne: 1});
            expect(window.getComputedStyle(d3.select('.annotation[data-index="1"] .bg').node()).fill)
                .toBe('rgb(200, 100, 0)');
            expect(layout.yaxis.range[1]).not.toBeCloseTo(ymax, 0);

            layout.annotations[0].font = {color: 'rgb(0, 255, 0)'};
            layout.annotations[1].bgcolor = 'rgb(0, 0, 255)';
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({annotationDrawOne: 2});
            expect(window.getComputedStyle(d3.select('.annotation[data-index="0"] text').node()).fill)
                .toBe('rgb(0, 255, 0)');
            expect(window.getComputedStyle(d3.select('.annotation[data-index="1"] .bg').node()).fill)
                .toBe('rgb(0, 0, 255)');

            Lib.extendFlat(layout.annotations[0], {yref: 'paper', y: 0.8});

            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({plot: 1});
            expect(layout.yaxis.range[1]).toBeCloseTo(ymax, 0);
        })
        .catch(failTest)
        .then(done);
    });

    it('redraws images all at once', function(done) {
        var data = [{y: [1, 2, 3], mode: 'markers'}];
        var layout = {};
        var jsLogo = 'https://images.plot.ly/language-icons/api-home/js-logo.png';

        var x, y, height, width;

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            layout.images = [{
                source: jsLogo,
                xref: 'paper',
                yref: 'paper',
                x: 0.1,
                y: 0.1,
                sizex: 0.2,
                sizey: 0.2
            }, {
                source: jsLogo,
                xref: 'x',
                yref: 'y',
                x: 1,
                y: 2,
                sizex: 1,
                sizey: 1
            }];
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({imageDraw: 1});
            expect(d3.selectAll('image').size()).toBe(2);

            var n = d3.selectAll('image').node();
            x = n.attributes.x.value;
            y = n.attributes.y.value;
            height = n.attributes.height.value;
            width = n.attributes.width.value;

            layout.images[0].y = 0.8;
            layout.images[0].sizey = 0.4;
            return Plotly.react(gd, data, layout);
        })
        .then(function() {
            countCalls({imageDraw: 1});
            var n = d3.selectAll('image').node();
            expect(n.attributes.x.value).toBe(x);
            expect(n.attributes.width.value).toBe(width);
            expect(n.attributes.y.value).not.toBe(y);
            expect(n.attributes.height.value).not.toBe(height);
        })
        .catch(failTest)
        .then(done);
    });

    it('can change config, and always redraws', function(done) {
        var data = [{y: [1, 2, 3]}];
        var layout = {};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            expect(d3.selectAll('.drag').size()).toBe(11);
            expect(d3.selectAll('.gtitle').size()).toBe(0);

            return Plotly.react(gd, data, layout, {editable: true});
        })
        .then(function() {
            expect(d3.selectAll('.drag').size()).toBe(11);
            expect(d3.selectAll('.gtitle').text()).toBe('Click to enter Plot title');
            countCalls({plot: 1});

            return Plotly.react(gd, data, layout, {staticPlot: true});
        })
        .then(function() {
            expect(d3.selectAll('.drag').size()).toBe(0);
            expect(d3.selectAll('.gtitle').size()).toBe(0);
            countCalls({plot: 1});

            return Plotly.react(gd, data, layout, {});
        })
        .then(function() {
            expect(d3.selectAll('.drag').size()).toBe(11);
            expect(d3.selectAll('.gtitle').size()).toBe(0);
            countCalls({plot: 1});
        })
        .catch(failTest)
        .then(done);
    });

    it('can put polar plots into staticPlot mode', function(done) {
        // tested separately since some of the relevant code is actually
        // in cartesian/graph_interact... hopefully we'll fix that
        // sometime and the test will still pass.
        var data = [{r: [1, 2, 3], theta: [0, 120, 240], type: 'scatterpolar'}];
        var layout = {};

        Plotly.newPlot(gd, data, layout)
        .then(countPlots)
        .then(function() {
            expect(d3.select(gd).selectAll('.drag').size()).toBe(4);

            return Plotly.react(gd, data, layout, {staticPlot: true});
        })
        .then(function() {
            expect(d3.select(gd).selectAll('.drag').size()).toBe(0);

            return Plotly.react(gd, data, layout, {});
        })
        .then(function() {
            expect(d3.select(gd).selectAll('.drag').size()).toBe(4);
        })
        .catch(failTest)
        .then(done);
    });

    it('can change data in candlesticks multiple times', function(done) {
        // test that we've fixed the original issue in
        // https://github.com/plotly/plotly.js/issues/2510

        function assertCalc(open, high, low, close) {
            expect(gd.calcdata[0][0]).toEqual(jasmine.objectContaining({
                min: low,
                max: high,
                med: close,
                q1: Math.min(open, close),
                q3: Math.max(open, close),
                dir: close >= open ? 'increasing' : 'decreasing'
            }));
        }
        var trace = {
            type: 'candlestick',
            low: [1],
            open: [2],
            close: [3],
            high: [4]
        };
        Plotly.newPlot(gd, [trace])
        .then(function() {
            assertCalc(2, 4, 1, 3);

            trace.low = [0];
            return Plotly.react(gd, [trace]);
        })
        .then(function() {
            assertCalc(2, 4, 0, 3);

            trace.low = [-1];
            return Plotly.react(gd, [trace]);
        })
        .then(function() {
            assertCalc(2, 4, -1, 3);

            trace.close = [1];
            return Plotly.react(gd, [trace]);
        })
        .then(function() {
            assertCalc(2, 4, -1, 1);
        })
        .catch(failTest)
        .then(done);
    });

    function aggregatedPie(i) {
        var labels = i <= 1 ?
            ['A', 'B', 'A', 'C', 'A', 'B', 'C', 'A', 'B', 'C', 'A'] :
            ['X', 'Y', 'Z', 'Z', 'Y', 'Z', 'X', 'Z', 'Y', 'Z', 'X'];
        var trace = {
            type: 'pie',
            values: [4, 1, 4, 4, 1, 4, 4, 2, 1, 1, 15],
            labels: labels,
            transforms: [{
                type: 'aggregate',
                groups: labels,
                aggregations: [{target: 'values', func: 'sum'}]
            }]
        };
        return {
            data: [trace],
            layout: {
                datarevision: i,
                colorway: ['red', 'orange', 'yellow', 'green', 'blue', 'violet']
            }
        };
    }

    var aggPie1CD = [[
        {v: 26, label: 'A', color: 'red', i: 0},
        {v: 9, label: 'C', color: 'orange', i: 2},
        {v: 6, label: 'B', color: 'yellow', i: 1}
    ]];

    var aggPie2CD = [[
        {v: 23, label: 'X', color: 'red', i: 0},
        {v: 15, label: 'Z', color: 'orange', i: 2},
        {v: 3, label: 'Y', color: 'yellow', i: 1}
    ]];

    function aggregatedScatter(i) {
        return {
            data: [{
                x: [1, 2, 3, 4, 6, 5],
                y: [2, 1, 3, 5, 6, 4],
                transforms: [{
                    type: 'aggregate',
                    groups: [1, -1, 1, -1, 1, -1],
                    aggregations: i > 1 ? [{func: 'last', target: 'x'}] : []
                }]
            }],
            layout: {daterevision: i + 10}
        };
    }

    var aggScatter1CD = [[
        {x: 1, y: 2, i: 0},
        {x: 2, y: 1, i: 1}
    ]];

    var aggScatter2CD = [[
        {x: 6, y: 2, i: 0},
        {x: 5, y: 1, i: 1}
    ]];

    function aggregatedParcoords(i) {
        return {
            data: [{
                type: 'parcoords',
                dimensions: [
                    {label: 'A', values: [1, 2, 3, 4]},
                    {label: 'B', values: [4, 3, 2, 1]}
                ],
                transforms: i ? [{
                    type: 'aggregate',
                    groups: [1, 2, 1, 2],
                    aggregations: [
                        {target: 'dimensions[0].values', func: i > 1 ? 'avg' : 'first'},
                        {target: 'dimensions[1].values', func: i > 1 ? 'first' : 'avg'}
                    ]
                }] :
                []
            }]
        };
    }

    var aggParcoords0Vals = [[1, 2, 3, 4], [4, 3, 2, 1]];
    var aggParcoords1Vals = [[1, 2], [3, 2]];
    var aggParcoords2Vals = [[2, 3], [4, 3]];

    function checkCalcData(expectedCD) {
        return function() {
            expect(gd.calcdata.length).toBe(expectedCD.length);
            expectedCD.forEach(function(expectedCDi, i) {
                var cdi = gd.calcdata[i];
                expect(cdi.length).toBe(expectedCDi.length, i);
                expectedCDi.forEach(function(expectedij, j) {
                    expect(cdi[j]).toEqual(jasmine.objectContaining(expectedij));
                });
            });
        };
    }

    function checkValues(expectedVals) {
        return function() {
            expect(gd._fullData.length).toBe(1);
            var dims = gd._fullData[0].dimensions;
            expect(dims.length).toBe(expectedVals.length);
            expectedVals.forEach(function(expected, i) {
                expect(dims[i].values).toEqual(expected);
            });
        };
    }

    function reactTo(fig) {
        return function() { return Plotly.react(gd, fig); };
    }

    it('can change pie aggregations', function(done) {
        Plotly.newPlot(gd, aggregatedPie(1))
        .then(checkCalcData(aggPie1CD))

        .then(reactTo(aggregatedPie(2)))
        .then(checkCalcData(aggPie2CD))

        .then(reactTo(aggregatedPie(1)))
        .then(checkCalcData(aggPie1CD))
        .catch(failTest)
        .then(done);
    });

    it('can change scatter aggregations', function(done) {
        Plotly.newPlot(gd, aggregatedScatter(1))
        .then(checkCalcData(aggScatter1CD))

        .then(reactTo(aggregatedScatter(2)))
        .then(checkCalcData(aggScatter2CD))

        .then(reactTo(aggregatedScatter(1)))
        .then(checkCalcData(aggScatter1CD))
        .catch(failTest)
        .then(done);
    });

    it('can change parcoords aggregations', function(done) {
        Plotly.newPlot(gd, aggregatedParcoords(0))
        .then(checkValues(aggParcoords0Vals))

        .then(reactTo(aggregatedParcoords(1)))
        .then(checkValues(aggParcoords1Vals))

        .then(reactTo(aggregatedParcoords(2)))
        .then(checkValues(aggParcoords2Vals))

        .then(reactTo(aggregatedParcoords(0)))
        .then(checkValues(aggParcoords0Vals))

        .catch(failTest)
        .then(done);
    });

    it('can change type with aggregations', function(done) {
        Plotly.newPlot(gd, aggregatedScatter(1))
        .then(checkCalcData(aggScatter1CD))

        .then(reactTo(aggregatedPie(1)))
        .then(checkCalcData(aggPie1CD))

        .then(reactTo(aggregatedParcoords(1)))
        .then(checkValues(aggParcoords1Vals))

        .then(reactTo(aggregatedScatter(1)))
        .then(checkCalcData(aggScatter1CD))

        .then(reactTo(aggregatedParcoords(2)))
        .then(checkValues(aggParcoords2Vals))

        .then(reactTo(aggregatedPie(2)))
        .then(checkCalcData(aggPie2CD))

        .then(reactTo(aggregatedScatter(2)))
        .then(checkCalcData(aggScatter2CD))

        .then(reactTo(aggregatedParcoords(0)))
        .then(checkValues(aggParcoords0Vals))
        .catch(failTest)
        .then(done);
    });

    it('can change frames without redrawing', function(done) {
        var data = [{y: [1, 2, 3]}];
        var layout = {};
        var frames = [{name: 'frame1'}];

        Plotly.newPlot(gd, {data: data, layout: layout, frames: frames})
        .then(countPlots)
        .then(function() {
            var frameData = gd._transitionData._frames;
            expect(frameData.length).toBe(1);
            expect(frameData[0].name).toBe('frame1');

            frames[0].name = 'frame2';
            return Plotly.react(gd, {data: data, layout: layout, frames: frames});
        })
        .then(function() {
            countCalls({});
            var frameData = gd._transitionData._frames;
            expect(frameData.length).toBe(1);
            expect(frameData[0].name).toBe('frame2');
        })
        .catch(failTest)
        .then(done);
    });

    // make sure we've included every trace type in this suite
    var typesTested = {};
    var itemType;
    for(itemType in Registry.modules) { typesTested[itemType] = 0; }
    for(itemType in Registry.transformsRegistry) { typesTested[itemType] = 0; }

    // Not really being supported... This isn't part of the main bundle, and it's pretty broken,
    // but it gets registered and used by a couple of the gl2d tests.
    delete typesTested.contourgl;

    function _runReactMock(mockSpec, done) {
        var mock = mockSpec[1];
        var initialJson;

        function fullJson() {
            var out = JSON.parse(Plotly.Plots.graphJson({
                data: gd._fullData.map(function(trace) { return trace._fullInput; }),
                layout: gd._fullLayout
            }));

            // TODO: does it matter that ax.tick0/dtick/range and zmin/zmax
            // are often not regenerated without a calc step?
            // in as far as editor and others rely on _full, I think the
            // answer must be yes, but I'm not sure about within plotly.js
            [
                'xaxis', 'xaxis2', 'xaxis3', 'xaxis4', 'xaxis5',
                'yaxis', 'yaxis2', 'yaxis3', 'yaxis4',
                'zaxis'
            ].forEach(function(axName) {
                var ax = out.layout[axName];
                if(ax) {
                    delete ax.dtick;
                    delete ax.tick0;

                    // TODO this one I don't understand and can't reproduce
                    // in the dashboard but it's needed here?
                    delete ax.range;
                }
                if(out.layout.scene) {
                    ax = out.layout.scene[axName];
                    if(ax) {
                        delete ax.dtick;
                        delete ax.tick0;
                        // TODO: this is the only one now that uses '_input_' + key
                        // as a hack to tell Plotly.react to ignore changes.
                        // Can we kill this?
                        delete ax.range;
                    }
                }
            });
            out.data.forEach(function(trace) {
                if(trace.type === 'contourcarpet') {
                    delete trace.zmin;
                    delete trace.zmax;
                }
            });

            return out;
        }

        // Make sure we define `_length` in every trace *in supplyDefaults*.
        // This is only relevant for traces that *have* a 1D concept of length,
        // and in addition to simplifying calc/plot logic later on, ths serves
        // as a signal to transforms about how they should operate. For traces
        // that do NOT have a 1D length, `_length` should be `null`.
        var mockGD = Lib.extendDeep({}, mock);
        supplyAllDefaults(mockGD);
        expect(mockGD._fullData.length).not.toBeLessThan((mock.data || []).length, mockSpec[0]);
        mockGD._fullData.forEach(function(trace, i) {
            var len = trace._length;
            if(trace.visible !== false && len !== null) {
                expect(typeof len).toBe('number', mockSpec[0] + ' trace ' + i + ': type=' + trace.type);
            }

            typesTested[trace.type]++;

            if(trace.transforms) {
                trace.transforms.forEach(function(transform) {
                    typesTested[transform.type]++;
                });
            }
        });

        Plotly.newPlot(gd, mock)
        .then(countPlots)
        .then(function() {
            initialJson = fullJson();

            return Plotly.react(gd, mock);
        })
        .then(function() {
            expect(fullJson()).toEqual(initialJson);
            countCalls({});
        })
        .catch(failTest)
        .then(done);
    }

    mockLists.svg.forEach(function(mockSpec) {
        it('can redraw "' + mockSpec[0] + '" with no changes as a noop (svg mocks)', function(done) {
            _runReactMock(mockSpec, done);
        });
    });

    mockLists.gl.forEach(function(mockSpec) {
        it('can redraw "' + mockSpec[0] + '" with no changes as a noop (gl mocks)', function(done) {
            _runReactMock(mockSpec, done);
        });
    });

    mockLists.mapbox.forEach(function(mockSpec) {
        it('@noCI can redraw "' + mockSpec[0] + '" with no changes as a noop (mapbpox mocks)', function(done) {
            Plotly.setPlotConfig({
                mapboxAccessToken: MAPBOX_ACCESS_TOKEN
            });
            _runReactMock(mockSpec, done);
        });
    });

    // since CI breaks up gl/svg types, and drops scattermapbox, this test won't work there
    // but I should hope that if someone is doing something as major as adding a new type,
    // they'll run the full test suite locally!
    it('@noCI tested every trace & transform type at least once', function() {
        for(var itemType in typesTested) {
            expect(typesTested[itemType]).toBeGreaterThan(0, itemType + ' was not tested');
        }
    });
});

describe('resizing with Plotly.relayout and Plotly.react', function() {
    var gd;

    beforeEach(function() {
        gd = createGraphDiv();
    });

    afterEach(destroyGraphDiv);

    it('recalculates autoranges when height/width change', function(done) {
        Plotly.newPlot(gd,
            [{y: [1, 2], marker: {size: 100}}],
            {width: 400, height: 400, margin: {l: 100, r: 100, t: 100, b: 100}}
        )
        .then(function() {
            expect(gd.layout.xaxis.range).toBeCloseToArray([-1.31818, 2.31818], 3);
            expect(gd.layout.yaxis.range).toBeCloseToArray([-0.31818, 3.31818], 3);

            return Plotly.relayout(gd, {height: 800, width: 800});
        })
        .then(function() {
            expect(gd.layout.xaxis.range).toBeCloseToArray([-0.22289, 1.22289], 3);
            expect(gd.layout.yaxis.range).toBeCloseToArray([0.77711, 2.22289], 3);

            gd.layout.width = 500;
            gd.layout.height = 500;
            return Plotly.react(gd, gd.data, gd.layout);
        })
        .then(function() {
            expect(gd.layout.xaxis.range).toBeCloseToArray([-0.53448, 1.53448], 3);
            expect(gd.layout.yaxis.range).toBeCloseToArray([0.46552, 2.53448], 3);
        })
        .catch(failTest)
        .then(done);
    });
});


describe('Plotly.react and uirevision attributes', function() {
    var gd;

    beforeEach(function() {
        gd = createGraphDiv();
    });

    afterEach(destroyGraphDiv);

    function checkState(dataKeys, layoutKeys, msg) {
        var np = Lib.nestedProperty;
        return function() {
            dataKeys.forEach(function(traceKeys, i) {
                var trace = gd.data[i];
                var fullTrace = gd._fullData.filter(function(ft) {
                    return ft._fullInput.index === i;
                })[0]._fullInput;

                for(var key in traceKeys) {
                    var val = traceKeys[key];
                    var valIn = Array.isArray(val) ? val[0] : val;
                    var valOut = Array.isArray(val) ? val[val.length - 1] : val;
                    expect(np(trace, key).get()).toEqual(valIn, msg + ': data[' + i + '].' + key);
                    expect(np(fullTrace, key).get()).toEqual(valOut, msg + ': _fullData[' + i + '].' + key);
                }
            });

            for(var key in (layoutKeys || {})) {
                var val = layoutKeys[key];
                var valIn = Array.isArray(val) ? val[0] : val;
                var valOut = Array.isArray(val) ? val[val.length - 1] : val;
                expect(np(gd.layout, key).get()).toEqual(valIn, msg + ': layout.' + key);
                expect(np(gd._fullLayout, key).get()).toEqual(valOut, msg + ': _fullLayout.' + key);
            }
        };
    }

    function _react(fig) {
        return function() {
            return Plotly.react(gd, fig);
        };
    }

    it('preserves zoom and trace visibility state until uirevision changes', function(done) {
        var checkNoEdits = checkState([{
        }, {
            visible: [undefined, true]
        }], {
            'xaxis.autorange': true,
            'yaxis.autorange': true
        }, 'initial');

        var checkHasEdits = checkState([{
        }, {
            visible: 'legendonly'
        }], {
            'xaxis.range[0]': 0,
            'xaxis.range[1]': 1,
            'xaxis.autorange': false,
            'yaxis.range[0]': 1,
            'yaxis.range[1]': 2,
            'yaxis.autorange': false
        }, 'with GUI edits');

        var i = 0;
        function fig(rev) {
            i++;
            return {
                data: [{y: [1, 3, i]}, {y: [2, 1, i + 1]}],
                layout: {uirevision: rev}
            };
        }

        function setEdits() {
            return Registry.call('_guiRelayout', gd, {
                'xaxis.range': [0, 1],
                'yaxis.range': [1, 2]
            })
            .then(function() {
                return Registry.call('_guiRestyle', gd, 'visible', 'legendonly', [1]);
            });
        }

        Plotly.newPlot(gd, fig('something'))
        .then(checkNoEdits)
        .then(setEdits)
        .then(checkHasEdits)
        .then(_react(fig('something')))
        .then(checkHasEdits)
        .then(_react(fig('something else!')))
        .then(checkNoEdits)
        .then(_react(fig('something')))
        // back to the first uirevision, but the changes are gone forever
        .then(checkNoEdits)
        // falsy uirevision - does not preserve edits
        .then(_react(fig(false)))
        .then(checkNoEdits)
        .then(setEdits)
        .then(checkHasEdits)
        .then(_react(fig(false)))
        .then(checkNoEdits)
        .catch(failTest)
        .then(done);
    });

    it('moves trace visibility with uid', function(done) {
        Plotly.newPlot(gd,
            [{y: [1, 3, 1], uid: 'a'}, {y: [2, 1, 2], uid: 'b'}],
            {uirevision: 'something'}
        )
        .then(function() {
            return Registry.call('_guiRestyle', gd, 'visible', 'legendonly', [1]);
        })
        // we hid the second trace, with uid b
        .then(checkState([{visible: [undefined, true]}, {visible: 'legendonly'}]))
        .then(_react({
            data: [{y: [1, 3, 1], uid: 'b'}, {y: [2, 1, 2], uid: 'a'}],
            layout: {uirevision: 'something'}
        }))
        // now the first trace is hidden, because it has uid b now!
        .then(checkState([{visible: 'legendonly'}, {visible: [undefined, true]}]))
        .catch(failTest)
        .then(done);
    });

    it('controls axis edits with axis.uirevision', function(done) {
        function fig(mainRev, xRev, yRev, x2Rev, y2Rev) {
            return {
                data: [{y: [1, 2, 1]}, {y: [3, 4, 3], xaxis: 'x2', yaxis: 'y2'}],
                layout: {
                    uirevision: mainRev,
                    grid: {columns: 2, pattern: 'independent'},
                    xaxis: {uirevision: xRev},
                    yaxis: {uirevision: yRev},
                    xaxis2: {uirevision: x2Rev},
                    yaxis2: {uirevision: y2Rev}
                }
            };
        }

        function checkAutoRange(x, y, x2, y2, msg) {
            return checkState([], {
                'xaxis.autorange': x,
                'yaxis.autorange': y,
                'xaxis2.autorange': x2,
                'yaxis2.autorange': y2
            }, msg);
        }

        function setExplicitRanges() {
            return Registry.call('_guiRelayout', gd, {
                'xaxis.range': [1, 2],
                'yaxis.range': [2, 3],
                'xaxis2.range': [3, 4],
                'yaxis2.range': [4, 5]
            });
        }

        Plotly.newPlot(gd, fig('a', 'x1a', 'y1a', 'x2a', 'y2a'))
        .then(checkAutoRange(true, true, true, true))
        .then(setExplicitRanges)
        .then(checkAutoRange(false, false, false, false))
        // change main rev (no effect) and y1 and x2
        .then(_react(fig('b', 'x1a', 'y1b', 'x2b', 'y2a')))
        .then(checkAutoRange(false, true, true, false))
        // now reset with falsy revisions for x2 & y2 but undefined for x1 & y1
        // to show that falsy says "never persist changes here" but undefined
        // will be inherited
        .then(_react(fig('a', undefined, undefined, false, '')))
        .then(checkAutoRange(true, true, true, true))
        .then(setExplicitRanges)
        .then(checkAutoRange(false, false, false, false))
        .then(_react(fig('a', undefined, undefined, false, '')))
        .then(checkAutoRange(false, false, true, true))
        .then(_react(fig('b', undefined, undefined, false, '')))
        .then(checkAutoRange(true, true, true, true))
        .catch(failTest)
        .then(done);
    });

    function _run(figFn, editFn, checkInitial, checkEdited) {
        // figFn should take 2 args (main uirevision and partial uirevision)
        // and return a figure {data, layout}
        // editFn, checkInitial, checkEdited are functions of no args
        return Plotly.newPlot(gd, figFn('main a', 'part a'))
        .then(checkInitial)
        .then(editFn)
        .then(checkEdited)
        .then(_react(figFn('main b', 'part a')))
        .then(checkEdited)
        .then(_react(figFn('main b', 'part b')))
        .then(checkInitial)
        .catch(failTest);
    }

    it('controls trace and pie label visibility from legend.uirevision', function(done) {
        function fig(mainRev, legendRev) {
            return {
                data: [
                    {y: [1, 2]},
                    {y: [2, 1]},
                    {type: 'pie', labels: ['a', 'b', 'c'], values: [1, 2, 3]}
                ],
                layout: {
                    uirevision: mainRev,
                    legend: {uirevision: legendRev}
                }
            };
        }

        function hideSome() {
            return Registry.call('_guiUpdate', gd,
                {visible: 'legendonly'},
                {hiddenlabels: ['b', 'c']},
                [0]
            );
        }

        function checkVisible(traces, hiddenlabels) {
            return checkState(
                traces.map(function(v) {
                    return {visible: v ? [undefined, true] : 'legendonly'};
                }),
                {hiddenlabels: hiddenlabels}
            );
        }
        var checkAllVisible = checkVisible([true, true], undefined);
        // wrap [b, c] in another array to distinguish it from
        // [layout, fullLayout]
        var checkSomeHidden = checkVisible([false, true], [['b', 'c']]);

        _run(fig, hideSome, checkAllVisible, checkSomeHidden).then(done);
    });

    it('preserves groupby group visibility', function(done) {
        // TODO: there's a known problem if the groups change... unlike
        // traces we will keep visibility by group in order, not by group value

        function fig(mainRev, legendRev) {
            return {
                data: [{
                    y: [1, 2, 3, 4, 5, 6],
                    transforms: [{
                        type: 'groupby',
                        groups: ['a', 'b', 'c', 'a', 'b', 'c']
                    }]
                }, {
                    y: [7, 8]
                }],
                layout: {
                    uirevision: mainRev,
                    legend: {uirevision: legendRev}
                }
            };
        }

        function hideSome() {
            return Registry.call('_guiRestyle', gd, {
                'transforms[0].styles[0].value.visible': 'legendonly',
                'transforms[0].styles[2].value.visible': 'legendonly'
            }, [0])
            .then(function() {
                return Registry.call('_guiRestyle', gd, 'visible', 'legendonly', [1]);
            });
        }

        function checkVisible(groups, extraTrace) {
            var trace0edits = {};
            groups.forEach(function(visi, i) {
                var attr = 'transforms[0].styles[' + i + '].value.visible';
                trace0edits[attr] = visi ? undefined : 'legendonly';
            });
            return checkState([
                trace0edits,
                {visible: extraTrace ? [undefined, true] : 'legendonly'}
            ]);
        }
        var checkAllVisible = checkVisible([true, true, true], true);
        var checkSomeHidden = checkVisible([false, true, false], false);

        _run(fig, hideSome, checkAllVisible, checkSomeHidden).then(done);
    });

    it('@gl preserves modebar interactions using modebar.uirevision', function(done) {
        function fig(mainRev, modebarRev) {
            return {
                data: [
                    {type: 'surface', z: [[1, 2], [3, 4]]},
                    {y: [1, 2]}
                ],
                layout: {
                    scene: {
                        domain: {x: [0, 0.4]},
                        hovermode: 'closest',
                        dragmode: 'zoom'
                    },
                    xaxis: {domain: [0.6, 1], showspikes: true},
                    yaxis: {showspikes: true},
                    uirevision: mainRev,
                    modebar: {uirevision: modebarRev},
                    hovermode: 'closest',
                    dragmode: 'zoom'
                }
            };
        }

        function attrs(original) {
            var dragmode = original ? 'zoom' : 'pan';
            var hovermode = original ? 'closest' : false;
            var spikes = original ? true : false;
            var spikes3D = original ? [undefined, true] : false;
            return {
                dragmode: dragmode,
                hovermode: hovermode,
                'xaxis.showspikes': spikes,
                'yaxis.showspikes': spikes,
                'scene.dragmode': dragmode,
                'scene.hovermode': hovermode,
                'scene.xaxis.showspikes': spikes3D,
                'scene.yaxis.showspikes': spikes3D,
                'scene.zaxis.showspikes': spikes3D
            };
        }

        function editModes() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkOriginalModes = checkState([], attrs(true));
        var checkEditedModes = checkState([], attrs());

        _run(fig, editModes, checkOriginalModes, checkEditedModes).then(done);
    });

    it('preserves geo viewport changes using geo.uirevision', function(done) {
        function fig(mainRev, geoRev) {
            return {
                data: [{
                    type: 'scattergeo', lon: [0, -75], lat: [0, 45]
                }],
                layout: {
                    uirevision: mainRev,
                    geo: {uirevision: geoRev}
                }
            };
        }

        function attrs(original) {
            return {
                'geo.projection.scale': original ? [undefined, 1] : 3,
                'geo.projection.rotation.lon': original ? [undefined, 0] : -45,
                'geo.center.lat': original ? [undefined, 0] : 22,
                'geo.center.lon': original ? [undefined, 0] : -45
            };
        }

        function editView() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkOriginalView = checkState([], attrs(true));
        var checkEditedView = checkState([], attrs());

        _run(fig, editView, checkOriginalView, checkEditedView).then(done);
    });

    it('@gl preserves 3d camera changes using scene.uirevision', function(done) {
        function fig(mainRev, sceneRev) {
            return {
                data: [{type: 'surface', z: [[1, 2], [3, 4]]}],
                layout: {
                    uirevision: mainRev,
                    scene: {uirevision: sceneRev}
                }
            };
        }

        function editCamera() {
            return Registry.call('_guiRelayout', gd, {
                'scene.camera': {
                    center: {x: 1, y: 2, z: 3},
                    eye: {x: 2, y: 3, z: 4},
                    up: {x: 0, y: 0, z: 1}
                }
            });
        }

        function _checkCamera(original) {
            return checkState([], {
                'scene.camera.center.x': original ? [undefined, 0] : 1,
                'scene.camera.center.y': original ? [undefined, 0] : 2,
                'scene.camera.center.z': original ? [undefined, 0] : 3,
                'scene.camera.eye.x': original ? [undefined, 1.25] : 2,
                'scene.camera.eye.y': original ? [undefined, 1.25] : 3,
                'scene.camera.eye.z': original ? [undefined, 1.25] : 4,
                'scene.camera.up.x': original ? [undefined, 0] : 0,
                'scene.camera.up.y': original ? [undefined, 0] : 0,
                'scene.camera.up.z': original ? [undefined, 1] : 1
            });
        }
        var checkOriginalCamera = _checkCamera(true);
        var checkEditedCamera = _checkCamera(false);

        _run(fig, editCamera, checkOriginalCamera, checkEditedCamera).then(done);
    });

    it('preserves selectedpoints using selectionrevision', function(done) {
        function fig(mainRev, selectionRev) {
            return {
                data: [{y: [1, 3, 1]}, {y: [2, 1, 3]}],
                layout: {
                    uirevision: mainRev,
                    selectionrevision: selectionRev,
                    dragmode: 'select',
                    width: 400,
                    height: 400,
                    margin: {l: 100, t: 100, r: 100, b: 100}
                }
            };
        }

        function editSelection() {
            // drag across the upper right quadrant, so we'll select
            // curve 0 point 1 and curve 1 point 2
            return drag(document.querySelector('.nsewdrag'),
                148, 100, '', 150, 102);
        }

        var checkNoSelection = checkState([
            {selectedpoints: undefined},
            {selectedpoints: undefined}
        ]);
        var checkSelection = checkState([
            {selectedpoints: [[1]]},
            {selectedpoints: [[2]]}
        ]);

        _run(fig, editSelection, checkNoSelection, checkSelection).then(done);
    });

    it('preserves polar view changes using polar.uirevision', function(done) {
        // polar you can control either at the subplot or the axis level
        function fig(mainRev, polarRev) {
            return {
                data: [{r: [1, 2], theta: [1, 2], type: 'scatterpolar', mode: 'lines'}],
                layout: {
                    uirevision: mainRev,
                    polar: {uirevision: polarRev}
                }
            };
        }

        function fig2(mainRev, polarRev) {
            return {
                data: [{r: [1, 2], theta: [1, 2], type: 'scatterpolar', mode: 'lines'}],
                layout: {
                    uirevision: mainRev,
                    polar: {
                        angularaxis: {uirevision: polarRev},
                        radialaxis: {uirevision: polarRev}
                    }
                }
            };
        }

        function attrs(original) {
            return {
                'polar.radialaxis.range[0]': original ? 0 : -2,
                'polar.radialaxis.range[1]': original ? 2 : 4,
                'polar.radialaxis.angle': original ? [undefined, 0] : 45,
                'polar.angularaxis.rotation': original ? [undefined, 0] : -90
            };
        }

        function editPolar() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkInitial = checkState([], attrs(true));
        var checkEdited = checkState([], attrs());

        _run(fig, editPolar, checkInitial, checkEdited)
        .then(function() {
            return _run(fig2, editPolar, checkInitial, checkEdited);
        })
        .then(done);
    });

    it('preserves ternary view changes using ternary.uirevision', function(done) {
        function fig(mainRev, ternaryRev) {
            return {
                data: [{a: [1, 2, 3], b: [2, 3, 1], c: [3, 1, 2], type: 'scatterternary'}],
                layout: {
                    uirevision: mainRev,
                    ternary: {uirevision: ternaryRev}
                }
            };
        }

        function fig2(mainRev, ternaryRev) {
            return {
                data: [{a: [1, 2, 3], b: [2, 3, 1], c: [3, 1, 2], type: 'scatterternary'}],
                layout: {
                    uirevision: mainRev,
                    ternary: {
                        aaxis: {uirevision: ternaryRev},
                        baxis: {uirevision: ternaryRev},
                        caxis: {uirevision: ternaryRev}
                    }
                }
            };
        }

        function attrs(original) {
            return {
                'ternary.aaxis.min': original ? [undefined, 0] : 0.1,
                'ternary.baxis.min': original ? [undefined, 0] : 0.2,
                'ternary.caxis.min': original ? [undefined, 0] : 0.3,
            };
        }

        function editTernary() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkInitial = checkState([], attrs(true));
        var checkEdited = checkState([], attrs());

        _run(fig, editTernary, checkInitial, checkEdited)
        .then(function() {
            return _run(fig2, editTernary, checkInitial, checkEdited);
        })
        .then(done);
    });

    it('@gl preserves mapbox view changes using mapbox.uirevision', function(done) {
        function fig(mainRev, mapboxRev) {
            return {
                data: [{lat: [1, 2], lon: [1, 2], type: 'scattermapbox'}],
                layout: {
                    uirevision: mainRev,
                    mapbox: {uirevision: mapboxRev}
                }
            };
        }

        function attrs(original) {
            return {
                'mapbox.center.lat': original ? [undefined, 0] : 1,
                'mapbox.center.lon': original ? [undefined, 0] : 2,
                'mapbox.zoom': original ? [undefined, 1] : 3,
                'mapbox.bearing': original ? [undefined, 0] : 4,
                'mapbox.pitch': original ? [undefined, 0] : 5
            };
        }

        function editMap() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkInitial = checkState([], attrs(true));
        var checkEdited = checkState([], attrs());

        Plotly.setPlotConfig({
            mapboxAccessToken: MAPBOX_ACCESS_TOKEN
        });

        _run(fig, editMap, checkInitial, checkEdited).then(done);
    });

    it('preserves editable: true shape & annotation edits using editrevision', function(done) {
        function fig(mainRev, editRev) {
            return {layout: {
                shapes: [{x0: 0, x1: 0.5, y0: 0, y1: 0.5}],
                annotations: [
                    {x: 1, y: 0, text: 'hi'},
                    {x: 1, y: 1, text: 'bye', showarrow: true, ax: -20, ay: 20}
                ],
                xaxis: {range: [0, 1]},
                yaxis: {range: [0, 1]},
                uirevision: mainRev,
                editrevision: editRev
            }};
        }

        function attrs(original) {
            return {
                'shapes[0].x0': original ? 0 : 0.1,
                'shapes[0].x1': original ? 0.5 : 0.2,
                'shapes[0].y0': original ? 0 : 0.3,
                'shapes[0].y1': original ? 0.5 : 0.4,
                'annotations[1].x': original ? 1 : 0.5,
                'annotations[1].y': original ? 1 : 0.6,
                'annotations[1].ax': original ? -20 : -30,
                'annotations[1].ay': original ? 20 : 30,
                'annotations[1].text': original ? 'bye' : 'buy'
            };
        }

        function editComponents() {
            return Registry.call('_guiRelayout', gd, attrs());
        }

        var checkInitial = checkState([], attrs(true));
        var checkEdited = checkState([], attrs());

        _run(fig, editComponents, checkInitial, checkEdited).then(done);
    });
});
