define([
    'jquery',
    'underscore',
    'backbone',
    'common',
    'app/views/widgets/hl-item-view',
], function($, _, Backbone, Common, HLItemView) {
    'use strict';

    var TaggedItemView = HLItemView.extend({
        tagName: 'tr',
        attributes: {
            draggable: 'true'
        },

        fileTemplate: _.template($('#tagged-item-file-tmpl').html()),
        fileMobileTemplate: _.template($('#tagged-item-file-mobile-tmpl').html()),
        dirTemplate: _.template($('#tagged-item-dir-tmpl').html()),
        dirMobileTemplate: _.template($('#tagged-item-dir-mobile-tmpl').html()),

        initialize: function(options) {
            HLItemView.prototype.initialize.call(this);

            this.taggedItemsView = options.taggedItemsView;
            this.taggedItems = this.taggedItemsView.taggedItems;

            this.listenTo(this.model, "change", this.render);
        },

        render: function() {
            var taggedItemsView = this.taggedItemsView;
            var file_icon_size = Common.isHiDPI() ? 48 : 24;
            var template;
            if (this.model.get('is_dir')) {
                template = $(window).width() < 768 ? this.dirMobileTemplate : this.dirTemplate;
            } else {
                template = $(window).width() < 768 ? this.fileMobileTemplate : this.fileTemplate;
            }

            this.$el.html(template({
                dirent: this.model.attributes,
                icon_url: this.model.getIconUrl(file_icon_size),
                url: this.model.getWebUrl(),
                repo_id: taggedItemsView.repo_id
            }));
            this.$('.file-locked-icon').attr('title', gettext("locked by {placeholder}").replace('{placeholder}', this.model.get('lock_owner_name')));
            // for image files
            this.$('.img-name-link').magnificPopup(this.taggedItemsView.magnificPopupOptions);

            return this;
        },

        events: {
            'click .dirent-name': 'visitDirent',
            'click .img-name-link': 'viewImageWithPopup',
        },

        visitDirent: function() {
            if ($(window).width() < 768 &&
                !this.model.get('is_img')) { // dir or non image file
                location.href = this.$('.dirent-name a').attr('href');
                return false;
            }
        },

        viewImageWithPopup: function() {
            var index = $('.img-name-link', this.taggedItemsView.$table).index(this.$('.img-name-link'));
            $.magnificPopup.open(this.taggedItemsView.magnificPopupOptions, index);
        }
    });

    return TaggedItemView;
});
