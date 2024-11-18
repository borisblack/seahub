define([
    'jquery',
    'jquery.ui',
    'jquery.magnific-popup',
    'simplemodal',
    'underscore',
    'backbone',
    'common',
    'file-tree',
    'js.cookie',
    'app/collections/tagged-items',
    'app/views/tagged-item'
    ], function($, jQueryUI, magnificPopup, simplemodal, _, Backbone, Common,
        FileTree, Cookies, TaggedItemCollection, TaggedItemView) {
        'use strict';

        var TaggedItemsView = Backbone.View.extend({
            el: '.main-panel',

            template: _.template($('#tagged-items-tmpl').html()),

            theadTemplate: _.template($('#tagged-items-thead-tmpl').html()),
            theadMobileTemplate: _.template($('#tagged-items-thead-mobile-tmpl').html()),

            initialize: function(options) {
                this.contextOptions = {};

                // For image files
                this.magnificPopupOptions = {
                    type: 'image',
                    tClose: gettext("Close (Esc)"), // Alt text on close button
                    tLoading: gettext("Loading..."), // Text that is displayed during loading. Can contain %curr% and %total% keys
                    gallery: {
                        enabled: true,
                        tPrev: gettext("Previous (Left arrow key)"), // Alt text on left arrow
                        tNext: gettext("Next (Right arrow key)"), // Alt text on right arrow
                        tCounter: gettext("%curr% of %total%") // Markup for "1 of 7" counter
                    },
                    image: {
                        titleSrc: function(item) {
                            var img_name = Common.HTMLescape(item.data.name);
                            var img_link = '<a href="' + item.data.url + '" target="_blank">' + gettext("Open in New Tab") + '</a>';
                            return img_name + '<br />' + img_link;
                        },
                        tError: gettext('<a href="%url%" target="_blank">The image</a> could not be loaded.') // Error message when image could not be loaded
                    }
                };

                this.taggedItems = new TaggedItemCollection();
                this.listenTo(this.taggedItems, 'add', this.addOne);
                this.listenTo(this.taggedItems, 'reset', this.reset);
            },

            renderMainCon: function(tagName) {
                if ($('#tagged-items').length) {
                    return;
                }

                this.$mainCon = $('<div class="main-panel-main" id="tagged-items"></div>').html(this.template({tagName: tagName}));
                this.$el.append(this.$mainCon);

                this.$loadingTip = this.$('.loading-tip');
                this.$con = this.$('.js-dir-content');
                this.$error = this.$('.error');

                this.$table = this.$('.tagged-item-list');
                this.$tbody = $('tbody', this.$table);

                var _this = this;
                $('.cur-view-main-con', this.$mainCon).on('scroll', function() {
                    _this.getMore();
                });
            },

            show: function(tagName, options) {
                this.contextOptions = options;
                this.renderMainCon(tagName);

                this.taggedItems.setTagName(tagName);
                this.taggedItems.dirent_more = false;

                this.renderTaggedItems();
            },

            hide: function() {
                this.$mainCon.detach();
            },

            /***** Private functions *****/
            addOne: function(dirent) {
                var view = new TaggedItemView({model: dirent, taggedItemsView: this});
                this.$tbody.append(view.render().el);
            },

            reset: function() {
                this.$con.hide();

                this.$table.hide();
                this.$tbody.empty();

                this.$con.show();

                this.renderThead();
                Common.updateSortIconByMode({'context': this.$table});
                this.$table.show();

                // sort
                this.sortDirents();

                this.taggedItems.last_start = 0;
                this.taggedItems.limit = 100;
                this.render_dirents_slice(this.taggedItems.last_start, this.taggedItems.limit);

                this.getThumbnail();
            },

            updateMagnificPopupOptions: function(options) {
                var repo_id = this.taggedItems.repo_id,
                    path = this.taggedItems.path;

                var use_thumbnail = true;
                if (!app.pageOptions.enable_thumbnail || this.taggedItems.encrypted) {
                    use_thumbnail = false;
                }
                var genItem = function(model) {
                    var parent_path = model.get('parent_path');
                    var name = model.get('obj_name');
                    var dirent_path = Common.pathJoin([parent_path, name]);
                    var url_options = {
                        'repo_id': repo_id,
                        'path': Common.encodePath(dirent_path)
                    };

                    var file_ext = name.substr(name.lastIndexOf('.') + 1).toLowerCase();
                    var is_gif = file_ext == 'gif' ? true : false;
                    var item_src;
                    if (use_thumbnail && !is_gif) {
                        item_src = Common.getUrl($.extend(url_options, {
                            'name': 'thumbnail_get',
                            'size': app.pageOptions.thumbnail_size_for_original
                        }));
                    } else {
                        item_src = Common.getUrl($.extend(url_options, {
                            'name': 'view_raw_file'
                        }));
                    }

                    var item = {
                        'name': name,
                        'url': model.getWebUrl(),
                        'src': item_src
                    };
                    return item;
                };

                var _this = this;
                var getItems = function() {
                    var imgs = _this.taggedItems.where({is_img: true});
                    var items = [];
                    $(imgs).each(function(index, model) {
                        var item = genItem(model);
                        items.push(item);
                    });
                    _this.magnificPopupOptions.items = items;
                };

                var addNewItem = function(model) {
                    var item = genItem(model);
                    // add the new item as the first
                    _this.magnificPopupOptions.items.unshift(item);
                };

                var updateItem = function(index, model) {
                    var item = genItem(model);
                    _this.magnificPopupOptions.items[index] = item;
                };

                var deleteItem = function(index) {
                    _this.magnificPopupOptions.items.splice(index, 1);
                };

                var op = options ? options.op : 'get-items';
                switch (op) {
                    case 'get-items':
                        getItems();
                        break;
                    case 'add-new-item':
                        addNewItem(options.model);
                        break;
                    case 'update-item':
                        updateItem(options.index, options.model);
                        break;
                    case 'delete-item':
                        deleteItem(options.index);
                        break;
                }
            },

            getThumbnail: function() {
                if (!app.pageOptions.enable_thumbnail || this.taggedItems.encrypted) {
                    return false;
                }

                var items = this.taggedItems.filter(function(dirent) {
                    // 'dirent' is a model
                    return (dirent.get('is_img') || dirent.get('is_video')) && !dirent.get('encoded_thumbnail_src');
                });
                if (items.length == 0) {
                    return ;
                }

                var items_length = items.length, _this = this;
                var thumbnail_size = app.pageOptions.thumbnail_default_size;
                var get_thumbnail = function(i) {
                    var cur_item = items[i];
                    var repo_id = cur_item.get('repo_id');
                    var parent_path = cur_item.get('parent_path');
                    var name = cur_item.get('obj_name');
                    var cur_item_path = Common.pathJoin([parent_path, name]);
                    $.ajax({
                        url: Common.getUrl({name: 'thumbnail_create', repo_id: repo_id}),
                        data: {
                            'path': cur_item_path,
                            'size': thumbnail_size
                        },
                        cache: false,
                        dataType: 'json',
                        success: function(data) {
                            cur_item.set({
                                'encoded_thumbnail_src': data.encoded_thumbnail_src
                            });
                        },
                        complete: function() {
                            if (i < items_length - 1) {
                                get_thumbnail(++i);
                            }
                        }
                    });
                };
                get_thumbnail(0);
            },

            renderTaggedItems: function() {
                this.$loadingTip.show();
                this.$con.hide();
                this.$error.hide();

                var _this = this;
                var thumbnail_size = app.pageOptions.thumbnail_default_size;
                var taggedItems = this.taggedItems;
                taggedItems.fetch({
                    cache: false,
                    //reset: true,
                    data: {
                        'thumbnail_size': thumbnail_size
                    },
                    success: function(collection, response, opts) {
                        if (response.next_url) {
                            window.open(response.next_url, '_self')
                        }
                        _this.reset();
                    },
                    error: function(collection, response, opts) {
                        var err_msg;
                        if (response.responseText) {
                            if (response.responseJSON.lib_need_decrypt) {
                                _this._showLibDecryptDialog();
                                return;
                            } else {
                                err_msg = Common.HTMLescape(response.responseJSON.error);
                            }
                        } else {
                            err_msg = gettext('Please check the network.');
                        }
                        _this.$error.html(err_msg).show();
                    },
                    complete: function() {
                        _this.$loadingTip.hide();
                    }
                });
            },

            renderThead: function() {
                var tmpl = $(window).width() < 768 ? this.theadMobileTemplate : this.theadTemplate;
                this.$('thead').html(tmpl());
            },

            render_dirents_slice: function(start, limit) {
                var taggedItems = this.taggedItems;
                _.each(taggedItems.slice(start, start + limit), this.addOne, this);
                if (taggedItems.length > start + limit) {
                    taggedItems.dirent_more = true;
                    taggedItems.last_start = start + limit;
                } else {
                    taggedItems.dirent_more = false;
                }
            },

            // Directory Operations
            events: {
                'click #tagged-items .by-name': 'sortByName',
                'click #tagged-items .by-time': 'sortByTime'
            },

            sortDirents: function() {
                var sort_mode = app.pageOptions.sort_mode;
                switch(sort_mode) {
                    case 'name_up':
                        this.taggedItems.comparator = function(a, b) {
                            if (a.get('is_dir') && b.get('is_file')) {
                                return -1;
                            }
                            if (a.get('is_file') && b.get('is_dir')) {
                                return 1;
                            }
                            var result = Common.compareTwoWord(a.get('obj_name'), b.get('obj_name'));
                            return result;
                        };
                        break;
                    case 'name_down':
                        this.taggedItems.comparator = function(a, b) {
                            if (a.get('is_dir') && b.get('is_file')) {
                                return -1;
                            }
                            if (a.get('is_file') && b.get('is_dir')) {
                                return 1;
                            }
                            var result = Common.compareTwoWord(a.get('obj_name'), b.get('obj_name'));
                            return -result;
                        };
                        break;
                    case 'time_up':
                        this.taggedItems.comparator = function(a, b) {
                            if (a.get('is_dir') && b.get('is_file')) {
                                return -1;
                            }
                            if (a.get('is_file') && b.get('is_dir')) {
                                return 1;
                            }
                            return a.get('last_modified') < b.get('last_modified') ? -1 : 1;
                        };
                        break;
                    case 'time_down':
                        this.taggedItems.comparator = function(a, b) {
                            if (a.get('is_dir') && b.get('is_file')) {
                                return -1;
                            }
                            if (a.get('is_file') && b.get('is_dir')) {
                                return 1;
                            }
                            return a.get('last_modified') < b.get('last_modified') ? 1 : -1;
                        };
                        break;
                }

                this.taggedItems.sort();
            },

            sortByName: function() {
                Common.toggleSortByNameMode();
                Common.updateSortIconByMode({'context': this.$table});
                this.sortDirents();

                this.$tbody.empty();
                this.render_dirents_slice(0, this.taggedItems.limit);
                this.taggedItems.comparator = null;
                return false;
            },

            sortByTime: function () {
                Common.toggleSortByTimeMode();
                Common.updateSortIconByMode({'context': this.$table});
                this.sortDirents();

                this.$tbody.empty();
                this.render_dirents_slice(0, this.taggedItems.limit);
                this.taggedItems.comparator = null;
                return false;
            },

            getMore: function () {
                var $el = this.$('.cur-view-main-con')[0];
                if (this.taggedItems.dirent_more &&
                    $el.scrollTop > 0 &&
                    $el.clientHeight + $el.scrollTop == $el.scrollHeight) { // scroll to the bottom
                    this.render_dirents_slice(this.taggedItems.last_start, this.taggedItems.limit);
                    this.getThumbnail();
                }
            }
        });

        return TaggedItemsView;
});
