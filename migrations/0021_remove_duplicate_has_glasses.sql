-- Remove duplicate 'hasGlasses' question.
-- 'wearsGlasses' covers the same trait and correctly maps to the 'appearance'
-- attribute group via the wears* prefix. 'hasGlasses' maps to 'possession',
-- causing both questions to be asked in the same game with identical answers.
DELETE FROM questions WHERE attribute_key = 'hasGlasses';
