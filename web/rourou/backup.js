(function (root) {
  'use strict';
  function store() {
    if (!root.ActorStore?.exportBundle || !root.ActorStore?.restoreBundle) throw new Error('完整备份组件未加载，请刷新后重试');
    return root.ActorStore;
  }
  async function validate(doc) {
    if (doc?.app !== 'rourou-world') throw new Error('此处只接受肉肉独立备份；主工作台备份请回工作台恢复');
    const checked = await store().validateBundle(doc, {petOnly:true, validatePet:root.PetSchema.validate});
    const files = new Map(checked.files.map(f => [f.id, f]));
    for (const ref of root.PetSchema.references(checked.pet)) {
      const file = files.get(ref.id);
      if (!file) throw new Error('肉肉独立备份缺少附件原件：' + ref.name);
      if (['name','type','size','sha256'].some(k => ref[k] !== file[k])) throw new Error('附件说明与原件不一致：' + ref.name);
    }
    return checked;
  }
  root.PetBackup = Object.freeze({
    async export(state) {
      const doc = await store().exportBundle({ petOnly: true, state: root.PetSchema.validate(state) });
      await validate(doc);
      return doc;
    },
    validate,
    async restore(doc, client) {
      await validate(doc);
      return store().restoreBundle(doc, { petOnly: true, petClient: client, validatePet: root.PetSchema.validate });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
