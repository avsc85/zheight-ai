-- Delete all chat messages first (due to foreign key constraint)
DELETE FROM public.chat_messages;

-- Delete all chat sessions
DELETE FROM public.chat_sessions;