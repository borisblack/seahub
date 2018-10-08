define([
    'underscore',
    'backbone',
    'common',
    'app/models/tagged-item'
], function(_, Backbone, Common, TaggedItem) {
    'use strict';

    var TaggedItemCollection = Backbone.Collection.extend({
        model: TaggedItem,

        url: function () {
            return Common.getUrl({name: 'tagged-items', tagName: this.tagName});
        },

        setTagName: function(tagName) {
            this.tagName = tagName;
        }
    });

    return TaggedItemCollection;
});
