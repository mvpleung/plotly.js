/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var extendFlat = require('../../lib/extend').extendFlat;
var scatterPolarAttrs = require('../scatterpolar/attributes');
var barAttrs = require('../bar/attributes');

module.exports = {
    r: scatterPolarAttrs.r,
    theta: scatterPolarAttrs.theta,
    r0: scatterPolarAttrs.r0,
    dr: scatterPolarAttrs.dr,
    theta0: scatterPolarAttrs.theta0,
    dtheta: scatterPolarAttrs.dtheta,
    thetaunit: scatterPolarAttrs.thetaunit,

    // orientation: {
    //     valType: 'enumerated',
    //     role: 'info',
    //     values: ['radial', 'angular'],
    //     editType: 'calc+clearAxisTypes',
    //     description: 'Sets the orientation of the bars.'
    // },

    base: extendFlat({}, barAttrs.base, {
        description: [
            'Sets where the bar base is drawn (in radial axis units).',
            'In *stack* barmode,',
            'traces that set *base* will be excluded',
            'and drawn in *overlay* mode instead.'
        ].join(' ')
    }),
    offset: extendFlat({}, barAttrs.offset, {
        description: [
            'Shifts the angular position where the bar is drawn',
            '(in *thetatunit* units).'
        ].join(' ')
    }),
    width: extendFlat({}, barAttrs.width, {
        description: [
            'Sets the bar angular width (in *thetaunit* units).'
        ].join(' ')
    }),

    text: extendFlat({}, barAttrs.text, {
        description: [
            'Sets hover text elements associated with each bar.',
            'If a single string, the same string appears over all bars.',
            'If an array of string, the items are mapped in order to the',
            'this trace\'s coordinates.'
        ].join(' ')
    }),
    // hovertext: barAttrs.hovertext,

    // textposition: {},
    // textfont: {},
    // insidetextfont: {},
    // outsidetextfont: {},
    // constraintext: {},
    // cliponaxis: extendFlat({}, barAttrs.cliponaxis, {dflt: false}),

    marker: barAttrs.marker,

    hoverinfo: scatterPolarAttrs.hoverinfo,

    selected: barAttrs.selected,
    unselected: barAttrs.unselected

    // error_x (error_r, error_theta)
    // error_y
};
