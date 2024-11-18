define([
    'jquery',
    'underscore',
    'backbone',
    'common',
    'app/views/widgets/hl-item-view'
], function($, _, Backbone, Common, HLItemView) {
    'use strict';

    var TagView = HLItemView.extend({
        tagName: 'tr',

        template: _.template($('#tag-item-tmpl').html()),

        initialize: function() {
            HLItemView.prototype.initialize.call(this);

            this.listenTo(this.model, "change", this.render);
        },

        render: function () {
            var data = this.model.toJSON();

            this.$el.html(this.template(data));

            return this;
        }
    });

    return TagView;
});
