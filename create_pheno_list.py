#!/scratch/rbierma1/DAP_pheweb_20250415/pheweb_env/bin/python
import pandas as pd
import glob
import json
import os

df = pd.read_csv("mlma_paths_with_metadata.csv")

#get the fpaths, the output of mlma_to_csv.py
data_df = pd.DataFrame({
    'fpath': glob.glob('data/*.csv'),
})
data_df["stem"] = data_df["fpath"].str.split("_N").str[0]
data_df["phenotype"] = data_df["stem"].str.split("/").str[-1]

df = df.merge(data_df)

json_data = []
for i,r in df.iterrows():
    json_data.append({
        'assoc_files': [ r['fpath'] ],
        'phenocode': r['pheweb_phenotype_name'],
        'category': r['pheweb_phenotype_category'],
        'num_samples': r['sample_size'],
    })

with open('pheno-list.json', 'w') as f_out:
    json.dump(json_data, f_out, indent=4)

