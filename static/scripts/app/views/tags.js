define([
    'jquery',
    'underscore',
    'backbone',
    'common',
    'app/collections/tags',
    'app/views/tag',
], function($, _, Backbone, Common, TagCollection, TagView) {
    'use strict';

    var TagsView = Backbone.View.extend({
        el: '.main-panel',

        template: _.template($('#tags-tmpl').html()),
        theadTemplate: _.template($('#tags-thead-tmpl').html()),

        initialize: function(options) {
            this.tags = new TagCollection();
            this.listenTo(this.tags, 'reset', this.reset);
        },

        addOne: function(tag, collection, options) {
            var view = new TagView({model: tag, tagsView: this});
            if (options.prepend) {
                this.$tableBody.prepend(view.render().el);
            } else {
                this.$tableBody.append(view.render().el);
            }
        },

        reset: function() {
            this.$('.error').hide();
            this.$loadingTip.hide();
            if (this.tags.length) {
                this.$emptyTip.hide();
                this.renderThead();
                this.$tableBody.empty();

                this.tags.each(this.addOne, this);
                this.$table.show();
            } else {
                this.$table.hide();
                this.$emptyTip.show();
            }
        },

        showTags: function() {
            this.$table.hide();
            this.$loadingTip.show();
            this.tags.fetch({reset: true});
        },

        renderThead: function() {
            this.$tableHead.html(this.theadTemplate());
        },

        renderMainCon: function() {
            this.$mainCon = $('<div class="main-panel-main" id="all-tags"></div>').html(this.template());
            this.$el.append(this.$mainCon);

            this.$table = this.$('table');
            this.$tableHead = this.$('thead');
            this.$tableBody = this.$('tbody');
            this.$loadingTip = this.$('.loading-tip');
            this.$emptyTip = this.$('.empty-tips');
        },

        show: function() {
            this.renderMainCon();
            this.showTags();
        },

        hide: function() {
            this.$mainCon.detach();
        }
    });

    return TagsView;
});
