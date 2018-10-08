define([
    'jquery',
    'underscore',
    'backbone',
    'common'
], function($, _, Backbone, Common) {
    'use strict';

    var TaggedItem = Backbone.Model.extend({

        // Get the absolute path within the library
        getPath: function() {
            return Common.pathJoin([this.get('parent_path'), this.get('obj_name')]);
        },

        getIconUrl: function(size) {
            if (this.get('is_dir')) {
                var is_readonly = this.get('perm') == 'r';
                return Common.getDirIconUrl(is_readonly, size);
            } else {
                return Common.getFileIconUrl(this.get('obj_name'), size);
            }
        },

        // Return the URL to visit the folder or file
        getWebUrl: function() {
            var dirent_path = this.getPath();
            var repo_id = this.get('repo_id');

            if (this.get('is_dir')) {
                return "#common/lib/" + repo_id + Common.encodePath(dirent_path);
            } else {
                return app.config.siteRoot + "lib/" + repo_id + "/file" + Common.encodePath(dirent_path);
            }
        }
    });

    return TaggedItem;
});
