## Summary

- 

## Change Type

- [ ] Data
- [ ] UI / Design
- [ ] Validation / Scripts
- [ ] Documentation
- [ ] Release / Deploy

## Required Checks

- [ ] `npm run scan:secrets`
- [ ] `npm run scan:release-text -- {electionId}`
- [ ] `npm run gen:data:dry -- {electionId}`
- [ ] `npm run gen:glossary:dry`
- [ ] `npm run validate:materials`
- [ ] `npm run validate:materials:strict`
- [ ] `npm run validate:data:strict`
- [ ] `npm run report:data:check -- {electionId}`
- [ ] `npm run build`
- [ ] `npm run smoke:preview`
- [ ] `npm run release:check -- {electionId}`

## Visual Checks

- [ ] `/`
- [ ] `/live`
- [ ] `/map`
- [ ] `/parties`
- [ ] `/proportional`
- [ ] `/archive`
- [ ] `/glossary`
- [ ] iPhone width

## Data Safety

- [ ] No API keys, tokens, passwords, private keys, or personal notes
- [ ] `public/data` was generated from `data/source`
- [ ] Party names, candidate names, districts, and seat counts come from JSON/CSV
- [ ] Dummy, sample, TODO, and draft text are not present in public release data
- [ ] Placeholder is used only for explicit missing candidate-photo fallback
- [ ] Official source URLs are recorded in `data/source/materials/official-sources.csv`
- [ ] Candidate photos have source and rights rows in `data/source/materials/photo-rights.csv`
- [ ] `photoUrl` and `photo-rights.csv` `photoFile` paths match for real person photos
- [ ] No unlicensed, unknown-source, or rights-unknown person photos are included

## Screenshots / Notes

- 

## Remaining TODO

- 
