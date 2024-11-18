define([
    'underscore',
    'backbone',
    'common',
    'app/models/tag'
], function(_, Backbone, Common, Tag) {
    'use strict';

    var TagCollection = Backbone.Collection.extend({
        model: Tag,
        url: function () {
            return Common.getUrl({name: 'all-tags'});
        }
    });

    return TagCollection;
});
