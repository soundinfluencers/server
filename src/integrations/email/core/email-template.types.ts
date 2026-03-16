import {InlineStyleObject} from "../components/list";

export type EmailTemplateResult = {
    subject: string;
    html: string;
    text?: string;
};

export type EmailCta = {
    label: string;
    href: string;
};

export type EmailInfoCard = {
    title: string;
    description: string;
    button: EmailCta;
    questionSrc?: string;
};

export type ListItem = // for list cards
    | {
    type: 'text';
    text: string;
}
    | {
    type: 'html';
    html: string;
    text?: string;
};

export type UserEmailBlock =
    | {
    type: 'greeting';
    text: string;
    style?: InlineStyleObject;
}
    | {
    type: 'paragraph';
    text: string;
    style?: InlineStyleObject;
}
    | {
    type: 'list';
    title?: string;
    items: Array<string | ListItem>;
    titleStyle?: InlineStyleObject;
    itemStyle?: InlineStyleObject;
    wrapperStyle?: InlineStyleObject;
    bulletImg?: string;
    disableBullets?: boolean;
}
    | {
    type: 'button';
    cta: EmailCta;
    wrapperStyle?: InlineStyleObject;
    containerStyle?: InlineStyleObject;
    linkStyle?: InlineStyleObject;
}
    | {
    type: 'infoCard';
    card: EmailInfoCard;
    wrapperStyle?: InlineStyleObject;
    titleStyle?: InlineStyleObject;
    descriptionStyle?: InlineStyleObject;
    buttonWrapperStyle?: InlineStyleObject;
}
    | {
    type: 'html';
    html: string;
    text?: string;
    style?: InlineStyleObject;
};

export type UserEmailTemplateInput = {
    subject: string;
    preheader?: string;
    headerImg?: boolean;

    title: string;
    subtitle?: string;

    footerNote?: string;

    blocks: UserEmailBlock[];
};