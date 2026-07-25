# Egg Runner!

## Backstory

I was describing my job as a Software Engineer to my 5-year-old the other day and talked about all the things I could code, including games. A couple months later he came up to me and wanted me to write him another game. I was like, “Sure, let’s see if AI can help write it.” He gave me the initial requirements, and we tweaked it as he QA’d it or had other suggestions.

This is the third game he had me make.

## Egg Runner

A kid-friendly side-scrolling game where Captain Eggbert jumps, ducks, stomps, and blasts through six wild worlds to save the coop.

Play at <https://egg.tryonlinux.com>

## Run locally

Serve the `public` folder:

```sh
python3 -m http.server --directory public
```

Then visit <http://localhost:8000>.

You can also run it with Cloudflare's local development server:

```sh
npx wrangler dev
```

## Cloudflare Workers

This is a static site, and `wrangler.jsonc` publishes the `public` folder. Deploy it with Wrangler or connect this repository to Cloudflare.

If you use a different custom domain, update:

- `public/index.html` for the canonical and `og:*` tags
- `public/robots.txt`
- `public/sitemap.xml`

Security headers are configured in `public/_headers`.

## License

MIT — see [LICENSE](LICENSE).
