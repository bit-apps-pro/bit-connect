/**
 * The one class name a mention link carries.
 *
 * Its own module because three unrelated layers need it and none of them should
 * have to import the others: the editor writes it, the comment formatter is the
 * only place allowed to keep a class on a link, and MentionService::MARKUP_CLASS
 * is the same string on the server, where the comment sanitizer admits it.
 */
export const MENTION_CLASS = 'bc-mention'
