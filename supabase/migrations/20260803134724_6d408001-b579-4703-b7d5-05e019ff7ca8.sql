ALTER TABLE public.journalists
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'press',
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS owner_note text;

ALTER TABLE public.journalists
  DROP CONSTRAINT IF EXISTS journalists_audience_check;
ALTER TABLE public.journalists
  ADD CONSTRAINT journalists_audience_check CHECK (audience IN ('press','lead'));

UPDATE public.journalists SET audience = 'press' WHERE audience IS NULL;

CREATE INDEX IF NOT EXISTS journalists_audience_active_idx ON public.journalists (audience, active);

ALTER TABLE public.segments
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'press';
ALTER TABLE public.segments
  DROP CONSTRAINT IF EXISTS segments_audience_check;
ALTER TABLE public.segments
  ADD CONSTRAINT segments_audience_check CHECK (audience IN ('press','lead'));

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'press';
ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_audience_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_audience_check CHECK (audience IN ('press','lead','all'));