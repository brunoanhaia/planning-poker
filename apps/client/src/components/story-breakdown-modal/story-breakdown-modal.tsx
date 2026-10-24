import { Story } from '@planitpoker/shared';
import { Modal } from 'antd';
import React from 'react';

import { useTranslation } from '../../i18n/use-translation';
import { StoryBreakdown } from '../story-breakdown/story-breakdown';

/** Modal wrapper around {@link StoryBreakdown}, opened from a backlog row. */
export const StoryBreakdownModal: React.FC<{ onClose: () => void; story: null | Story }> = ({
    onClose,
    story,
}) => {
    const { t } = useTranslation();

    if (!story) {
        return null;
    }

    return (
        <Modal
            footer={null}
            onCancel={onClose}
            open={Boolean(story)}
            title={t('breakdown.title', { title: story.title })}
            width={720}
        >
            <StoryBreakdown story={story} />
        </Modal>
    );
};
