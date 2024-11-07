import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import deepCopy from 'deep-copy';
import { CenteredLoading } from '@seafile/sf-metadata-ui-component';
import metadataAPI from '../../../api';
import Metadata from '../../../model/metadata';
import { normalizeColumns } from '../../../utils/column';
import { gettext } from '../../../../utils/constants';
import { Utils } from '../../../../utils/utils';
import toaster from '../../../../components/toast';
import Gallery from '../../gallery/main';
import { useMetadataView } from '../../../hooks/metadata-view';
import { PER_LOAD_NUMBER, VIEW_TYPE, VIEW_TYPE_DEFAULT_SORTS, EVENT_BUS_TYPE } from '../../../constants';

import './index.css';
import '../../gallery/index.css';

const PeoplePhotos = ({ people, onClose, onDeletePeoplePhotos }) => {
  const [isLoading, setLoading] = useState(true);
  const [isLoadingMore, setLoadingMore] = useState(false);
  const [metadata, setMetadata] = useState({ rows: [] });
  const repoID = window.sfMetadataContext.getSetting('repoID');

  const { deleteFilesCallback } = useMetadataView();

  const onLoadMore = useCallback(async () => {
    if (isLoadingMore) return;
    if (!metadata.hasMore) return;
    setLoadingMore(true);

    metadataAPI.getPeoplePhotos(repoID, people._id, metadata.recordsCount, PER_LOAD_NUMBER).then(res => {
      const rows = res?.data?.results || [];
      let newMetadata = deepCopy(metadata);
      if (Array.isArray(rows) && rows.length > 0) {
        newMetadata.rows.push(...rows);
        rows.forEach(record => {
          newMetadata.row_ids.push(record._id);
          newMetadata.id_row_map[record._id] = record;
        });
        const loadedCount = rows.length;
        newMetadata.hasMore = loadedCount === PER_LOAD_NUMBER;
        newMetadata.recordsCount = newMetadata.row_ids.length;
      } else {
        newMetadata.hasMore = false;
      }
      setMetadata(newMetadata);
      setLoadingMore(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoadingMore(false);
    });

  }, [isLoadingMore, metadata, people, repoID]);

  const deletedByIds = useCallback((ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const newMetadata = deepCopy(metadata);
    const idNeedDeletedMap = ids.reduce((currIdNeedDeletedMap, rowId) => ({ ...currIdNeedDeletedMap, [rowId]: true }), {});
    newMetadata.rows = newMetadata.rows.filter((row) => !idNeedDeletedMap[row._id]);
    newMetadata.row_ids = newMetadata.row_ids.filter((id) => !idNeedDeletedMap[id]);

    // delete rows in id_row_map
    ids.forEach(rowId => {
      delete newMetadata.id_row_map[rowId];
    });
    newMetadata.recordsCount = newMetadata.row_ids.length;
    setMetadata(newMetadata);

    if (newMetadata.rows.length === 0) {
      onClose && onClose();
    }
    onDeletePeoplePhotos && onDeletePeoplePhotos(people._id, ids);
  }, [metadata, onClose, people, onDeletePeoplePhotos]);

  const handelDelete = useCallback((deletedImages, callback) => {
    if (!deletedImages.length) return;
    let recordIds = [];
    let paths = [];
    let fileNames = [];
    deletedImages.forEach((record) => {
      const { id, path: parentDir, name } = record || {};
      if (parentDir && name) {
        const path = Utils.joinPath(parentDir, name);
        paths.push(path);
        fileNames.push(name);
        recordIds.push(id);
      }
    });
    window.sfMetadataContext.batchDeleteFiles(repoID, paths).then(res => {
      callback && callback();
      deletedByIds(recordIds);
      deleteFilesCallback(paths, fileNames);
      let msg = fileNames.length > 1
        ? gettext('Successfully deleted {name} and {n} other items')
        : gettext('Successfully deleted {name}');
      msg = msg.replace('{name}', fileNames[0])
        .replace('{n}', fileNames.length - 1);
      toaster.success(msg);
    }).catch(error => {
      toaster.danger(gettext('Failed to delete records'));
    });
  }, [deleteFilesCallback, repoID, deletedByIds]);

  useEffect(() => {
    const repoID = window.sfMetadataContext.getSetting('repoID');
    metadataAPI.getPeoplePhotos(repoID, people._id, 0, PER_LOAD_NUMBER).then(res => {
      const rows = res?.data?.results || [];
      const columns = normalizeColumns(res?.data?.metadata);
      let metadata = new Metadata({ rows, columns, view: { sorts: VIEW_TYPE_DEFAULT_SORTS[VIEW_TYPE.GALLERY] } });
      if (rows.length < PER_LOAD_NUMBER) {
        metadata.hasMore = false;
      }
      setMetadata(metadata);
      setLoading(false);
    }).catch(error => {
      const errorMessage = Utils.getErrorMsg(error);
      toaster.danger(errorMessage);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.sfMetadataContext.eventBus.dispatch(EVENT_BUS_TYPE.TOGGLE_VIEW_TOOLBAR, true);
    return () => {
      window.sfMetadataContext.eventBus.dispatch(EVENT_BUS_TYPE.TOGGLE_VIEW_TOOLBAR, false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) return (<CenteredLoading />);

  return (
    <div className="sf-metadata-face-recognition-container sf-metadata-people-photos-container">
      <div className="sf-metadata-people-photos-header">
        <div className="sf-metadata-people-photos-header-back" onClick={onClose}>
          <i className="sf3-font sf3-font-arrow rotate-180"></i>
        </div>
        <div className="sf-metadata-people-name">{people._name || gettext('Person image')}</div>
      </div>
      <Gallery metadata={metadata} isLoadingMore={isLoadingMore} onLoadMore={onLoadMore} onDelete={handelDelete} />
    </div>
  );
};

PeoplePhotos.propTypes = {
  people: PropTypes.object,
  onClose: PropTypes.func,
  onDelete: PropTypes.func,
};

export default PeoplePhotos;