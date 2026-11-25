import { GlobalOutlined } from '@ant-design/icons';
import { Button, Dropdown, MenuProps, Tooltip } from 'antd';
import React from 'react';

import { LANGUAGES, LANGUAGE_SHORT_LABELS, Language } from '../../i18n/languages';
import { useTranslation } from '../../i18n/use-translation';

/**
 * Language picker for the application bar.
 *
 * A menu rather than a two-state switch: a switch would have to assume there
 * are only ever two languages, and its label would lie the moment a third
 * ships.
 *
 * The compact code on the button makes the active language visible without
 * opening the menu, while the accessible label still spells it out.
 */
export const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage, t } = useTranslation();

    const items: MenuProps['items'] = LANGUAGES.map((code: Language) => ({
        key: code,
        label: t(`language.${code}`),
    }));

    return (
        <Dropdown
            menu={{
                items,
                onClick: ({ key }) => setLanguage(key as Language),
                selectable: true,
                selectedKeys: [language],
            }}
            trigger={['click']}
        >
            <Tooltip title={t('nav.language')}>
                <Button
                    aria-label={t('nav.language.current', {
                        language: t(`language.${language}`),
                    })}
                    icon={<GlobalOutlined aria-hidden />}
                    type="text"
                >
                    {LANGUAGE_SHORT_LABELS[language]}
                </Button>
            </Tooltip>
        </Dropdown>
    );
};
