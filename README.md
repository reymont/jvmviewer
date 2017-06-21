## jvmviewer

## 构建镜像
```
# docker build -t reymont/jvmviewer .
```

## 运行容器
```
# docker run -d --name jvmviewer \
    --restart=always \
    -p 7778:8080 \
	reymont/jvmviewer .
```

## 参数说明
> http://192.168.0.180:7778/jvmviewer/jolokia.html?ip=<jmx_ip>&port=<jmx_port>
> <jmx_ip>：jmx暴露的IP
> <jmx_port>: jmx暴露的端口
> 例如：http://192.168.0.180:7778/jvmviewer/jolokia.html?ip=10.1.100.2&port=10001
