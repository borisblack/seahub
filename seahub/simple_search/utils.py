import logging
import re
import stat
from seahub.utils.file_types import IMAGE, DOCUMENT, SPREADSHEET, SVG, PDF, MARKDOWN, VIDEO, AUDIO, TEXT
from seahub.utils import get_user_repos
from seahub.base.templatetags.seahub_tags import email2nickname, email2contact_email
from seaserv import seafile_api


logger = logging.getLogger(__name__)

SEARCH_FILEEXT = {
    TEXT: ('ac', 'am', 'bat', 'c', 'cc', 'cmake', 'cpp', 'cs', 'css', 'diff', 'el', 'h', 'html', 'htm', 'java', 'js', 'json', 'less', 'make', 'org', 'php', 'pl', 'properties', 'py', 'rb', 'scala', 'script', 'sh', 'sql', 'txt', 'text', 'tex', 'vi', 'vim', 'xhtml', 'xml', 'log', 'csv', 'groovy', 'rst', 'patch', 'go'),
    IMAGE: ('gif', 'jpeg', 'jpg', 'png', 'ico', 'bmp', 'tif', 'tiff', 'eps'),
    DOCUMENT: ('doc', 'docx', 'ppt', 'pptx', 'odt', 'fodt', 'odp', 'fodp'),
    SPREADSHEET: ('xls', 'xlsx', 'ods', 'fods'),
    SVG: ('svg',),
    PDF: ('pdf',),
    MARKDOWN: ('markdown', 'md'),
    VIDEO: ('mp4', 'ogv', 'webm', 'mov'),
    AUDIO: ('mp3', 'oga', 'ogg'),
    '3D': ('stl', 'obj'),
}


def is_valid_date(data):
    try:
        data = int(data)
        return True
    except (TypeError, ValueError):
        return False


def is_valid_size(data):
    try:
        data = int(data)
        if data < 0:
            return False
        return True
    except (TypeError, ValueError):
        return False


def get_int(data, default_val=None):
    try:
        return int(data)
    except (TypeError, ValueError):
        return default_val


def get_search_repos_map(search_repo, username, org_id):
    def map_repo(repo_list, val):
        repo_map = {}
        for repo in repo_list:
            repo_map[repo.id] = val

        return repo_map

    # Get repos
    owned_repos, shared_repos, groups_repos, public_repos = get_user_repos(username, org_id=org_id)
    if search_repo == 'mine':
        repo_list = owned_repos
    elif search_repo == 'shared':
        repo_list = shared_repos
    elif search_repo == 'group':
        repo_list = groups_repos
    elif search_repo == 'public':
        repo_list = public_repos
    else:
        repo_list = owned_repos + shared_repos + groups_repos + public_repos

    # Create repo_id_map
    repo_id_map = {}
    for repo in repo_list:
        has_origin = False
        search_repo_id = repo.id
        if repo.origin_repo_id:
            search_repo_id = repo.origin_repo_id
            has_origin = True

        if search_repo_id not in repo_id_map or not has_origin:
            repo_id_map[search_repo_id] = repo

    # Create repo_type_map
    if search_repo in ('mine', 'shared', 'group', 'public'):
        repo_type_map = map_repo(repo_list, search_repo)
    else:
        repo_type_map = {}
        repo_type_map.update(map_repo(owned_repos, 'mine'))
        repo_type_map.update(map_repo(shared_repos, 'shared'))
        repo_type_map.update(map_repo(public_repos, 'public'))
        repo_type_map.update(map_repo(groups_repos, 'group'))

    return repo_id_map, repo_type_map


def search_files(repo_id_map, search_path, keyword, obj_desc, start=0, size=10, org_id=None):
    if search_path is None:
        search_path = '/'

    files_found = []
    for repo_id in repo_id_map:
        repo = seafile_api.get_repo(repo_id)
        if not repo.owner:
            if org_id:
                repo.owner = seafile_api.get_org_repo_owner(repo_id)
            else:
                repo.owner = seafile_api.get_repo_owner(repo_id)

        if not hasattr(repo, 'owner_nickname') or not repo.owner_nickname:
            repo.owner_nickname = email2nickname(repo.owner)

        if not hasattr(repo, 'owner_contact_email') or not repo.owner_contact_email:
            repo.owner_contact_email = email2contact_email(repo.owner)

        file_list = search_files_in_repo(repo, search_path, keyword, obj_desc)
        files_found += file_list

    total = len(files_found)

    files_found.sort(cmp_items)

    return files_found[start:start + size], total


def search_files_in_repo(repo, search_path, keyword, obj_desc):
    def is_matched(d):
        """
        Filter function
        :param d: dirent object
        :return: True if object meets the conditions, False otherwise
        """
        obj_type = obj_desc.get('obj_type')
        suffixes = obj_desc['suffixes']
        time_range = obj_desc['time_range']
        time_from = time_range[0]
        time_to = time_range[1]
        size_range = obj_desc['size_range']
        size_from = size_range[0]
        size_to = size_range[1]

        if re.search(keyword, d.obj_name, re.I) is None:  # check keyword
            return False

        if obj_type is not None:  # check obj_type
            is_dir = stat.S_ISDIR(d.mode)
            if (is_dir and obj_type == 'file') or (not is_dir and obj_type == 'dir'):
                return False

        if suffixes is not None:  # check suffixes
            suffix = d.obj_name.split('.')[-1]
            if suffix not in suffixes:
                return False

        if time_from is not None:  # check time_from
            if d.mtime < int(time_from):
                return False

        if time_to is not None:  # check time_to
            if d.mtime > int(time_to):
                return False

        if size_from is not None:  # check size_from
            if d.size < int(size_from):
                return False

        if size_to is not None:  # check size_to
            if d.size > int(size_to):
                return False

        return True

    if search_path[-1] != '/':
        search_path = '{0}/'.format(search_path)

    file_list = []
    dirs = seafile_api.list_dir_by_path(repo.repo_id, search_path)
    for dirent in dirs:
        is_dir = stat.S_ISDIR(dirent.mode)
        if is_matched(dirent):
            f = {
                'oid': dirent.object_id,
                'repo_id': repo.repo_id,
                'name': dirent.obj_name,
                'permission': dirent.permission,
                'is_dir': is_dir,
                'fullpath': search_path + dirent.obj_name,
                'parent_dir': search_path.rstrip('/'),
                'last_modified_by': dirent.modifier,
                'last_modified': dirent.mtime,
                'size': dirent.size,
                'repo': repo,
                'repo_name': repo.name,
                'repo_owner_email': repo.owner,
                'repo_owner_name': repo.owner_nickname,
                'repo_owner_contact_email': repo.owner_contact_email
            }

            if repo.origin_path:
                if f['fullpath'].startswith(repo.origin_path):
                    f['repo_id'] = repo.repo_id
                    f['fullpath'] = f['fullpath'].split(repo.origin_path)[-1]

            file_list.append(f)

        if is_dir:  # directory
            # Recursive call
            nested_list = search_files_in_repo(repo, search_path + dirent.obj_name + '/', keyword, obj_desc)
            file_list.extend(nested_list)

    return file_list


def cmp_items(a, b):
    def cmp_siblings(a, b):
        if a['name'] > b['name']:
            return 1
        elif a['name'] < b['name']:
            return -1

        return 0

    if b['is_dir'] and not a['is_dir']:
        return 1
    elif a['is_dir'] and not b['is_dir']:
        return -1

    return cmp_siblings(a, b)
