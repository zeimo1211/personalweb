# Cloudflare Pages deployment

This uniapp project builds the web site to:

```text
unpackage/dist/build/web
```

## Recommended: GitHub auto deployment

Cloudflare Pages can watch a GitHub repository and deploy automatically after each push.

Because this project is built locally by HBuilderX, commit the web build output in this repository and let Cloudflare publish that directory directly.

### One-time setup

1. Push this repository to GitHub.
2. In Cloudflare Pages, create a project with **Connect to Git**.
3. Select the GitHub repository.
4. Use these build settings:

```text
Framework preset: None
Build command: leave empty, or use exit 0
Deploy command: leave empty
Build output directory: unpackage/dist/build/web
Root directory: /
```

After this, every push to the selected GitHub branch will trigger a new deployment.

### Update flow

1. Build the web version in HBuilderX.
2. Run:

```bat
cloudflare-pages-deploy.bat
```

3. Commit and push the updated files:

```bat
git add .
git commit -m "Update site"
git push
```

Cloudflare Pages will deploy the new version automatically.

## Alternative: manual upload

1. Build the web version in HBuilderX.
2. Run:

```bat
cloudflare-pages-deploy.bat
```

3. Deploy the `unpackage/dist/build/web` folder to Cloudflare Pages.

## Cloudflare Pages settings

For dashboard drag-and-drop deployment:

- Upload target: `unpackage/dist/build/web`
- The folder must contain `index.html`, `assets/`, `static/`, and `_headers`.

For Wrangler deployment:

```bat
npx wrangler pages deploy "unpackage\dist\build\web"
```

## Custom domain

In Cloudflare Pages, open the Pages project, then go to **Custom domains** and add the domain you want to serve.

For an apex domain such as `example.com`, add the domain to Cloudflare and change the nameservers at your domain registrar to Cloudflare's nameservers.

For a subdomain such as `www.example.com`, you can keep DNS at your current registrar and add a CNAME record pointing the subdomain to your Pages domain, for example:

```text
Type: CNAME
Name: www
Value: <your-project>.pages.dev
```

Cloudflare still requires adding the custom domain in the Pages dashboard before the CNAME will work correctly.
