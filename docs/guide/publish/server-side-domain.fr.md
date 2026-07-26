---
title: Domaine géré côté serveur
description: Omettez `site` et l'artefact n'embarque aucune URL absolue — la même sortie derrière n'importe quel domaine. Le coût se limite au SEO.
sidebar:
  label: Domaine côté serveur
  order: 3
---

# Domaine géré côté serveur ? Omettez `site`

Quand le domaine public est l'affaire du **serveur** — un vhost ou un reverse proxy en
frontal, plusieurs miroirs, ou un domaine pas encore choisi — ne définissez simplement
pas `site` (et ne passez pas de `--site`). L'artefact devient **agnostique de
l'origine** : pas une seule URL absolue n'y est embarquée, la *même* sortie fonctionne
donc derrière n'importe quel domaine, et changer de domaine n'exige jamais de rebuild.

## Ce qui change

| Surface | Avec `site` | Sans |
| --- | --- | --- |
| `llms.txt` / `llms-full.txt` / doubles `.md` | URL absolues | chemins relatifs à la racine (les agents les résolvent contre l'origine depuis laquelle ils les ont récupérés) |
| alternates `hreflang` | absolues | par chemins |
| canonical, `og:url`, JSON-LD | émis | non émis — ils n'ont de sens qu'avec une origine |
| sitemap + ligne `Sitemap:` de robots.txt | émis | non émis — les spécifications exigent des URL absolues |

## Ce que cela coûte, concrètement

**La visibilité dans les moteurs de recherche — rien d'autre.** Sans sitemap, URL
canoniques ni `hreflang` valide, les crawlers ne découvrent les pages qu'en suivant les
liens, rien ne consolide les doublons si la doc répond sur plusieurs domaines, et les
pages multilingues n'envoient aucun signal de langue aux moteurs de recherche. Les
aperçus de liens sociaux gardent leur titre/description mais perdent la carte d'URL.
**Les lecteurs humains et les agents IA ne perdent rien** — chaque page, double et
fichier llms fonctionne à l'identique.

Règle simple : hébergement interne, miroir, ou domaine pas encore arrêté → omettez
`site` ; un site public dont le référencement compte → définissez `site`.

## `base` reste indépendant

Définissez [`base`](./configuration.md) dès que le site vit sous un sous-chemin, avec ou
sans domaine — un sous-chemin affecte toujours les liens rendus, il ne peut donc pas
être laissé au serveur.
